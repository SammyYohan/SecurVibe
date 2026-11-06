# GuardVibe

**Audits de sécurité réels pour les SaaS créés avec l'IA** — scanner GitHub + audit de production, en ≈ 60 secondes, 100 % gratuit, sans compte.

> 🌍 Interface disponible en 8 langues : English · Français · Español · Deutsch · Português (BR) · 日本語 · 简体中文 · العربية (RTL).
> Les rapports d'audit (constats, correctifs) sont rédigés en anglais — standard des outils de sécurité — et s'affichent dans tous les environnements linguistiques.

---

## Fonctionnalités réelles (aucune simulation)

| Module | Ce qui est vérifié | Source de données |
| --- | --- | --- |
| **Scanner de dépôt** | Secrets en dur (PAT GitHub, clés Stripe/OpenAI/Anthropic/Slack/GitLab, AWS, PEM privés, JWT signés, URLs de base de données), priorisation par risque, jusqu'à 200 fichiers | Contenu réel via `raw.githubusercontent.com` + repli API GitHub |
| **Dépendances** | Avis CVE/GHSA réels avec niveau de gravité (OSV.dev) à partir des versions exactes résolues dans le lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) | [OSV.dev](https://osv.dev) (base publique gratuite, sans clé) |
| **Hygiène** | `.env` commités, exclusion `.env*` dans `.gitignore`, lockfile, workflows CI, bibliothèques de hachage (bcrypt/argon2) | Arborescence + fichiers du dépôt |
| **Audit de production** | Accessibilité HTTPS, redirection HTTP→HTTPS, certificat TLS (jours restants, handshake réel), 6 en-têtes de sécurité (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | Requêtes HTTP + `tls.connect` vers l'URL soumise |

**Score** : `100 − 15 × critiques − 5 × avertissements − 10 × (échec de l'étape décisive de l'audit de production)`. Un constat critique plafonne le score à 79. Chaque constat embarque une explication et un correctif copier-collable.

### Boucle de correction (100 % côté navigateur)

1. **« Copier la liste de correctifs (Markdown) »** — checklist prête à coller dans Cursor / Claude Code / Copilot : chaque constat devient `- [ ]` avec son correctif, puis on ré-audite pour vérifier.
2. **Tendance locale** — le score est comparé à l'audit précédent **sur la même cible** (repo + URL de production) : `↗ +X` / `↘ −X` / `=`. Historique dans `localStorage` (50 derniers audits, aucune donnée serveur, jamais le jeton).
3. **« Ré-auditer après corrections »** — relance en un clic la même cible avec les mêmes paramètres.

---

## Stack

> 🎨 Le système de design (palette, typographie, composants) est documenté dans [`DESIGN.md`](./DESIGN.md).

- **Next.js 16** (App Router, RSC), **React 19**, **TypeScript strict**
- **Tailwind CSS v4**, lucide-react, composants UI maison (sans bibliothèque externe lourde)
- **zod** pour tous les contrats (schémas partagés client/serveur)
- Streaming **NDJSON** avec annulation propagée (`AbortSignal`/`AbortSignal.any`)
- Aucune base de données, aucun compte, aucun stockage serveur
- Quotas gérés via **Upstash Redis** (API REST stateless) avec repli mémoire automatique
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
│   │   ├── support/page.tsx    ← soutien au projet (dons Ko-fi / PayPal & quotas)
│   │   ├── pricing/page.tsx    ← redirection permanente vers /support
│   │   ├── legal/page.tsx      ← CGU & confidentialité
│   │   ├── app/page.tsx        ← dashboard (scanner)
│   │   ├── error.tsx           ← frontière d'erreur localisée
│   │   └── not-found.tsx
│   ├── api/scan/route.ts       ← POST streaming NDJSON (réel, quotas, slots)
│   └── globals.css
├── components/
│   ├── dashboard/              ← Dashboard, ScanForm (+ sample), ScanStatus,
│   │                             SecurityReport, SiteAuditPanel
│   ├── site/                   ← LocaleSwitcher, SiteFooter, Logo, SectionHeading
│   └── ui/                     ← primitives maison (Button, Badge, Card, Input...)
├── lib/
│   ├── i18n/                   ← config locales, 8 dictionnaires typés, moteur
│   ├── env.ts                  ← variables serveur validées (zod)
│   ├── validation.ts           ← schémas de requête partagés (zod)
│   ├── score.ts                ← formule du score (plafond à 79 en cas de critique)
│   ├── rateLimit.ts            ← limiteur en mémoire par instance
│   ├── quota.ts                ← quotas partagés Upstash Redis + repli mémoire
│   ├── lockfile.ts             ← résolveur de versions npm, pnpm et yarn lock
│   ├── secrets.ts              ← règles de détection de secrets & conseils
│   ├── ssrf.ts                 ← validation d'URL anti-SSRF (DNS, IPs privées)
│   └── plans.ts                ← constantes de quotas et limites d'audit
├── services/
│   ├── scanService.ts          ← scanner dépôt (GitHub raw + règles + OSV.dev)
│   ├── siteService.ts          ← audit production (HTTPS, TLS, headers)
│   └── vulnClient.ts           ← client OSV.dev (batch + sévérité)
├── types/index.ts              ← contrats zod (ScanEvent, Finding, TestStep…)
└── proxy.ts                    ← redirection négociée par Accept-Language (Next 16)
```

---

## Modèle économique & Quotas d'usage loyal

GuardVibe est **100 % gratuit, sans inscription et sans publicité**.

Le maintien du service est soutenu par des **dons volontaires** (Ko-fi, PayPal). Des quotas d'usage loyal protègent l'infrastructure et garantissent la disponibilité pour tous :

| Quota | Limite | Description |
| --- | --- | --- |
| **Par minute** | 6 audits | Fenêtre glissante par IP (anti-rafales) |
| **Par jour** | 30 audits | Par IP et par tranche UTC de 24 h |
| **Plafond global** | 1 000 audits | Par jour pour l'ensemble du service |
| **Concurrence** | 3 simultanés | Par instance de serveur (garde-fou mémoire/CPU) |
| **Profondeur** | 200 fichiers | Par audit de dépôt GitHub |

Les quotas sont vérifiés via Upstash Redis (API REST pipeline) et basculent automatiquement en mémoire locale si le store est indisponible (principe « fail-open »).

---

## Configuration

Toutes les variables sont **optionnelles** (voir `.env.example`) :

- `GITHUB_TOKEN` — quota serveur 60→5000 requêtes/h quand l'utilisateur ne fournit pas le sien ;
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` — store partagé des quotas (Upstash) ;
- `NEXT_PUBLIC_KOFI_URL` & `NEXT_PUBLIC_PAYPAL_URL` — liens de dons pour la page `/support` ;
- `NEXT_PUBLIC_SITE_URL` — URL canonique + hreflang ;
- `CONTACT_EMAIL` — adresse de contact affichée sur la page légale.

**Token utilisateur** : champ optionnel dans le formulaire de scan, transmis pour la requête courante uniquement, jamais stocké côté serveur ni client.

---

## Sécurité du produit

- Protection **anti-SSRF stricte** (`ssrf.ts`) : vérification des résolutions DNS, blocage des plages privées (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, link-local, multicast, cloud metadata IPv4/IPv6).
- Validation stricte **avant** tout streaming (JSON 400 sans fuite de stack trace).
- Toutes les variables d'environnement lues via schéma zod ; secrets jamais exposés via `NEXT_PUBLIC_`.
- Limiteurs en couches (minute, jour, concurrence, global).
- Annulation propre des flux via `AbortSignal`.

---

## Déploiement

1. `pnpm build` (pages pré-générées statiquement pour les 8 langues).
2. Renseigner les variables d'environnement optionnelles sur votre hébergeur (Vercel, Node, etc.).
3. Tout est prêt : i18n, SEO (hreflang + canonique), anti-SSRF, streaming NDJSON.
