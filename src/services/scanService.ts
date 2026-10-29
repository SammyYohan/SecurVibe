import "server-only";

import { sleep, isAbortError } from "@/lib/sleep";
import { parseGithubRepoUrl } from "@/lib/validation";
import type { Finding, ProgressRange, ScanEvent } from "@/types";

/** Analyse simulée du dépôt : 8 fichiers, chacun produit un constat. */
const TOTAL_FILES = 8;

const DEMO_FINDINGS: readonly Finding[] = [
  {
    id: "f-01",
    file: "src/components/checkout/PaymentForm.tsx",
    severity: "CRITICAL",
    issue: "Clé secrète Stripe écrite en dur dans un composant client",
    explanation:
      "Une clé secrète Stripe (« sk_test_<REDACTED> ») est déclarée en dur dans ce composant marqué « use client ». Tout code présent dans un composant client est téléchargé par le navigateur : la clé apparaît donc dans les fichiers JavaScript servis aux visiteurs et dans l'onglet Réseau des outils de développement. Même en mode test, une clé divulguée permet de manipuler la configuration du compte Stripe associé, et une clé de production divulguée expose directement les transactions et les données clients.",
    fix: `// Déplacer l'appel vers un Route Handler exécuté exclusivement côté serveur.
// src/app/api/create-payment-intent/route.ts
import { z } from "zod";

const envSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1), // jamais préfixé NEXT_PUBLIC_
});

export async function POST(): Promise<Response> {
  const stripeSecret = envSchema.parse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  }).STRIPE_SECRET_KEY;

  const stripe = new Stripe(stripeSecret); // valeur vérifiée avant construction du client

  // Créer le PaymentIntent ici et renvoyer uniquement le client_secret
  // au composant client : la clé secrète ne quitte jamais le serveur.
}`,
  },
  {
    id: "f-02",
    file: "src/app/api/orders/route.ts",
    severity: "CRITICAL",
    issue: "Aucune vérification d'authentification ni de propriété (IDOR)",
    explanation:
      "La route de lecture des commandes ne vérifie ni la session de l'utilisateur ni l'appartenance des enregistrements. Un attaquant peut donc parcourir les identifiants de génération pour lire la commande de n'importe quel autre utilisateur : nom, adresse, historique d'achat. Ce défaut, dit IDOR (Insecure Direct Object Reference), est l'un des plus exploités sur les SaaS en début de vie.",
    fix: `// 1. Exiger une session authentifiée avant toute lecture.
const session = await getSession();
if (session === null) {
  return Response.json({ error: "Non authentifié" }, { status: 401 });
}

// 2. Filtrer par l'identifiant de l'utilisateur authentifié, jamais par
//    un identifiant reçu du client.
const orders = await db.order.findMany({
  where: { userId: session.userId },
});
return Response.json({ orders });`,
  },
  {
    id: "f-03",
    file: "src/app/api/webhooks/stripe/route.ts",
    severity: "WARNING",
    issue: "Signature du webhook Stripe non vérifiée",
    explanation:
      "La route traite les événements envoyés par Stripe sans vérifier leur signature. Comme la route est publiquement accessible, n'importe qui peut forger une requête : marquer un abonnement comme payé, créer de faux événements de facturation ou déclencher des actions applicatives (provisioning, e-mails) sans avoir rien payé.",
    fix: `// Lire le corps brut avant de vérifier la signature.
const rawBody = await request.text();
const signature = request.headers.get("stripe-signature");
if (signature === null) {
  return new Response("Signature manquante", { status: 400 });
}

const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
// webhookSecret provient d'une variable d'environnement validée côté serveur.
// Toute vérification en échec renvoie 400 et stoppe le traitement.`,
  },
  {
    id: "f-04",
    file: "src/app/api/export/route.ts",
    severity: "WARNING",
    issue: 'En-tête CORS "Access-Control-Allow-Origin: *" sur une route sensible',
    explanation:
      "La route d'export des données autorise n'importe quelle origine externe à lire sa réponse. Combinée à des données utilisateurs, cette configuration permet à un site malveillant de déclencher l'export depuis le navigateur d'un visiteur connecté et de récupérer le résultat, selon la politique de contrôle d'accès appliquée.",
    fix: `// N'autoriser que les origines explicitement connues.
const allowedOrigins = new Set(["https://mon-saas.com"]);

const origin = request.headers.get("origin");
if (origin !== null && !allowedOrigins.has(origin)) {
  return new Response("Origine non autorisée", { status: 403 });
}

const headers = new Headers();
if (origin !== null) {
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin"); // empêche la mise en cache d'une réponse CORS générique
}`,
  },
  {
    id: "f-05",
    file: "src/components/blog/PostBody.tsx",
    severity: "WARNING",
    issue: "dangerouslySetInnerHTML sans assainissement (risque XSS)",
    explanation:
      "Le composant injecte du HTML provenant du contenu publié directement dans le DOM. Si un auteur, un import ou un champ utilisateur parvient à y placer du JavaScript (balise script, attribut onerror), le script s'exécute avec les droits de la session du lecteur : vol de session, action à l'insu de l'utilisateur, redistribution des données du tableau de bord.",
    fix: `// Assainir les entrées avant tout rendu HTML dynamique.
import DOMPurify from "dompurify";

export function PostBody({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
  return <article dangerouslySetInnerHTML={{ __html: clean }} />;
}

// En complément : définir une politique CSP stricte et préférer un
// rendu Markdown => React (sans innerHTML) quand c'est possible.`,
  },
  {
    id: "f-06",
    file: ".gitignore",
    severity: "OK",
    issue: "Fichiers .env* exclus du dépôt",
    explanation:
      "Le fichier .gitignore exclut correctement les fichiers de variables d'environnement (.env, .env.local et variantes). Aucun fichier de ce type n'est suivi dans l'historique git, les secrets du développement ne fuient donc pas dans le dépôt.",
    fix: `// Conserver la règle actuelle et la rendre explicite :
.env*
!.env.example

// Ajouter un contrôle en pre-commit pour détecter tout fichier
// contenant un secret avant qu'il ne soit historisé.`,
  },
  {
    id: "f-07",
    file: "src/lib/auth/password.ts",
    severity: "OK",
    issue: "Mots de passe hachés avec bcrypt et sel",
    explanation:
      "Le service d'authentification utilise bcrypt avec un coût paramétré et un sel généré automatiquement : les mots de passe ne sont ni stockés en clair, ni hachés avec une fonction rapide (MD5, SHA-1). Le verrouillage progressif retarde les attaques par force brute.",
    fix: `// Conserver bcrypt et vérifier que le coût reste >= 12.
const passwordHash = await bcrypt.hash(password, COST_ROUNDS);
const isValid = await bcrypt.compare(candidate, passwordHash);

// Ne jamais journaliser les mots de passe ni leurs hachages.`,
  },
  {
    id: "f-08",
    file: "package.json",
    severity: "OK",
    issue: "Aucune dépendance avec une vulnérabilité connue (résultat simulé)",
    explanation:
      "L'audit des dépendances directes et transitives ne remonte aucune CVE connue dans les versions verrouillées (résultat simulé : en mode démo, aucun appel réseau n'est effectué).",
    fix: `// Planifier l'audit dans la CI pour garder ce contrôle vert :
pnpm audit --prod

// Mettre à jour les correctifs régulièrement (renovate/dependabot)
// et committer pnpm-lock.yaml pour des installations reproductibles.`,
  },
];

/**
 * Analyse un dépôt et émet des événements de scan. Simulé : aucun accès
 * réseau. Annulation : `signal` interrompt chaque temporisation et le
 * générateur se termine silencieusement.
 */
export async function* scanRepository(
  input: { repoUrl: string },
  range: ProgressRange,
  signal: AbortSignal,
): AsyncGenerator<ScanEvent, void, void> {
  try {
    // Défense en profondeur : revalider même si la route API l'a fait.
    if (parseGithubRepoUrl(input.repoUrl) === null) {
      yield {
        type: "error",
        code: "INVALID_URL",
        message: "URL de dépôt GitHub invalide.",
      };
      return;
    }

    const repoName = parseGithubRepoUrl(input.repoUrl)?.repo;

    if (repoName === "not-found") {
      yield {
        type: "error",
        code: "REPO_NOT_FOUND",
        message:
          "Dépôt GitHub introuvable. Vérifiez l'URL ou les droits d'accès.",
      };
      return;
    }

    if (repoName === "boom") {
      throw new Error("Échec simulé du service d'analyse.");
    }

    yield { type: "scan_started", totalFiles: TOTAL_FILES };

    for (let index = 0; index < DEMO_FINDINGS.length; index += 1) {
      const finding = DEMO_FINDINGS[index];
      if (finding === undefined) return; // ne peut arriver : tableau littéral

      await sleep(randomIntBetween(300, 900), signal);
      yield { type: "finding", finding };
      yield { type: "progress", value: interpolate(range, index + 1, DEMO_FINDINGS.length) };
    }
  } catch (error) {
    // Annulation : fin silencieuse, sans événement d'erreur.
    if (!isAbortError(error)) throw error;
  }
}

/** Interpolation linéaire de la progression globale dans la plage allouée. */
function interpolate(range: ProgressRange, current: number, total: number): number {
  const ratio = current / total;
  return Math.round(range.from + ratio * (range.to - range.from));
}

function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
