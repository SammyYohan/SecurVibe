# GuardVibe

**Audits de sécurité réels pour les SaaS créés avec l'IA** — scanner GitHub + audit de production, en ≈ 60 secondes, sans compte.

> 🌍 Interface disponible en 8 langues : English · Français · Español · Deutsch · Português (BR) · 日本語 · 简体中文 · العربية (RTL).
> Les rapports d'audit (constats, correctifs) sont rédigés en anglais — standard des outils de sécurité — et s'affichent dans tous les environnements linguistiques.

---

## Fonctionnalités réelles (aucune simulation)

| Module | Ce qui est vérifié | Source de données |
| --- | --- | --- |
| **Scanner de dépôt** | Secrets en dur (PAT GitHub, clés Stripe/OpenAI/Slack/GitLab, AWS, PEM privés, JWT signés, identifiants génériques), ligne par ligne, 50 fichiers max | Contenu réel via `raw.githubusercontent.com` (hors quota API) |
| **Dépendances** | Avis CVE/GHSA réels sur vos versions npm épinglées, dépendances non épinglées | [OSV.dev](https://osv.dev) (base publique gratuite, sans clé) |
| **Hygiène** | `.env` commités, exclusion `.env*` dans `.gitignore`, lockfile, workflows CI, bibliothèques de hachage (bcrypt/argon2) | Arborescence + fichiers du dépôt |
| **Audit de production** | Accessibilité HTTPS, redirection HTTP→HTTPS, certificat TLS (jours restants, handshake réel), 6 en-têtes de sécurité (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | Requêtes HTTP + `tls.connect` vers l'URL soumise |

**Score** : `100 − 15 × critiques − 5 × avertissements − 10 × (échec de l'étape décisive de l'audit de production)`. Chaque constat embarque une explication et un correctif copier-collable.

---

## Stack

- **Next.js 16** (App Router, RSC), **React 19**, **TypeScript strict**
- **Tailwind CSS v4**, lucide-react, composants UI maison (shadcn-style)
- **zod** pour tous les contrats (schémas partagés client/serveur)
- Streaming **NDJSON** avec annulation propagée (`AbortSignal`/`AbortSignal.any`)
- Aucune base de données, aucun compte, aucun stockage serveur
- pnpm uniquement (Node ≥ 20.9)

```bash
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm dev          # développement
pnpm build && pnpm start
pnpm lint && pnpm typecheck
```

---

## Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx          ← layout racine (lang/dir RTL, SEO hreflang)
│   │   ├── page.tsx            ← landing (hero, bénéfices, comparatif, FAQ)
│   │   ├── pricing/page.tsx    ← tarification (4 plans + pack à l'unité)
│   │   ├── legal/page.tsx      ← CGU & confidentialité
│   │   ├── app/page.tsx        ← dashboard (scanner)
│   │   ├── error.tsx           ← frontière d'erreur localisée
│   │   └── not-found.tsx
│   ├── api/scan/route.ts       ← POST streaming NDJSON (réel)
│   └── globals.css
├── components/
│   ├── dashboard/              ← Dashboard, ScanForm (+ token), ScanStatus,
│   │                             SecurityReport, SiteAuditPanel
│   ├── site/                   ← LocaleSwitcher, SiteFooter
│   └── ui/                     ← primitives maison
├── lib/
│   ├── i18n/                   ← config locales, dictionnaires typés, moteur
│   ├── env.ts                  ← variables serveur validées (zod)
│   ├── validation.ts           ← schémas de requête partagés
│   ├── score.ts                ← formule du score
│   ├── rateLimit.ts            ← limiteur en mémoire (12 req/min/IP)
│   └── pricing.ts              ← tarifs + liens Stripe optionnels
├── services/
│   ├── scanService.ts          ← scanner dépôt (GitHub raw + règles + OSV.dev)
│   ├── siteService.ts          ← audit production (HTTPS, TLS, headers)
│   └── vulnClient.ts           ← client OSV.dev (batch)
├── types/index.ts              ← contrats zod (ScanEvent, Finding, TestStep…)
└── middleware.ts               ← redirection negociée par Accept-Language
```

---

## Tarification & modèle économique

Coûts marginaux quasi nuls (quotas simples : GitHub raw hors API, OSV.dev gratuit, vérifications HTTP locales) → marges élevées dès le premier client.

| Plan | Prix | Contenu |
| --- | --- | --- |
| **Free** | 0 € | 3 audits/mois, contrôles de base, sans carte |
| **Essential** | 9 €/mois (90 €/an) | audits illimités, audit de production, scan 200 fichiers |
| **Pro** | 24 €/mois | + multi-dépôts client, 500 fichiers, workspace token partagé |
| **Team** | 79 €/mois | + 5 sièges, revue trimestrielle, facture |
| **Pack** | 12 € | 10 audits à l'unité, 6 mois — sans abonnement |

Les montants s'affichent automatiquement en EUR (fr/es/de) ou USD (autres) via `Intl.NumberFormat` ; le paiement passe par Stripe. En accès anticipé, les plans payants sont activés **manuellement sous 24 h** après paiement (aucune promesse technique non encore tenue).

**Différenciation concurrentielle** : sans compte → premier rapport en 60 s ; vos données ne sont ni comptées ni stockées ; token utilisateur optionnel (votre quota, vos permissions) ; pack à l'unité unique contre un marché à abonnement ; 8 langues dont l'arabe RTL ; correctifs exploitables par constat.

---

## Configuration

Toutes les variables sont **optionnelles** (voir `.env.example`) :

- `GITHUB_TOKEN` — quota serveur 60→5000 requêtes/h quand l'utilisateur ne fournit pas le sien ;
- `STRIPE_LINK_ESSENTIAL` / `_PRO` / `_TEAM` / `_PACK` — Payment Links ; si absents, les boutons affichent l'accès anticipé ;
- `NEXT_PUBLIC_SITE_URL` — canonique + hreflang.

**Token utilisateur** : champ dédié du dashboard, utilisé pour une seule requête, jamais persisté côté serveur ni navigateur. Utiliser un token *fine-grained* en lecture seule.

---

## Sécurité du produit lui-même

- Validation stricte **avant** tout streaming (400 JSON sans fuite) ; aucune stack trace au client.
- Toutes les variables d'environnement lues via schéma zod ; secrets jamais en `NEXT_PUBLIC_`.
- Limiteur en mémoire (12 audits/min/IP) + protection par la forme stricte des URL.
- Le SHA du contenu est lu sur `raw.githubusercontent.com` — ni exécution, ni `eval`, ni échantillonnage des données scannées.
- Vérifiables : `curl -X GET /api/scan` → **405** ; JSON invalide → **400** ; coupure du flux pendant le scan → **0 événement d'erreur** côté serveur (testé).

---

## Recettes de test

```bash
# Scan réel (repo public expressjs/express + exemple.com)
curl -sN -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/expressjs/express","productionUrl":"https://example.com"}'

# Repo inexistant → {"type":"error","code":"REPO_NOT_FOUND",…}
# Exactitude linguistique : /fr /de /ja /zh-cn /ar → 200, /fr/pricing → 200
```

Redirection par `Accept-Language` middleware : `/` + `Accept-Language: fr-CA` → **307 → `/fr`**.

---

## Déploiement

1. `pnpm build` (36 pages pré-générées statiquement — coût quasi nul en hébergement serverless type Vercel).
2. Variables d'environnement (cf. configuration ci-dessus).
3. Stripe : créer 4 Payment Links → remplir `STRIPE_LINK_*`.
4. Tout le reste est déjà en place : i18n, SEO (hreflang + canonique), limites, streaming.

---

## Contrats techniques

- `ScanEvent` (NDJSON) : `scan_started {totalFiles}` · `progress {value}` · `finding {finding}` · `test_step {step}` · `done {score, mode:"real"}` · `error {code, message}`.
- Codes d'erreur d'événement : `INVALID_URL`, `REPO_NOT_FOUND`, `INTERNAL_ERROR`. Le 429 (limiteur) utilise `{"error":{"code":"RATE_LIMITED",…}}`.
- Étape 4 (en-têtes HTTP) a modestement mission d'étape décisive : ≥ 3 en-têtes manquants ⇒ `FAILED` ⇒ −10 au score.
