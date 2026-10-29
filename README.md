# GuardVibe

Scanner de santé et de sécurité pour applications SaaS créées par IA. Un seul
écran, un design sombre minimaliste, un flux de résultats en temps réel
(NDJSON). **Mode démo** : tous les services sont simulés, aucune donnée ne
quitte le serveur, aucun appel réseau n'est effectué.

## Prérequis

- Node.js **20.9.0** ou supérieur
- pnpm **9** ou supérieur (exclusivement — pas npm, pas yarn)

## Installation et lancement

```bash
pnpm install
pnpm dev
```

Ouvrir <http://localhost:3000>.

Autres scripts :

```bash
pnpm typecheck   # tsc --noEmit (strict)
pnpm lint        # eslint
pnpm build       # build de production
pnpm start       # sert le build de production
```

## Structure du projet

```
guardvibe/
├── .env.example                  # variables d'environnement (aucun secret réel)
├── next.config.ts                # en-têtes de sécurité globaux
├── src/
│   ├── app/
│   │   ├── globals.css           # thème sombre unique (Tailwind v4)
│   │   ├── layout.tsx            # <html lang="fr">, polices système
│   │   ├── page.tsx              # Server Component → <Dashboard />
│   │   ├── error.tsx             # boundary d'erreur de la page
│   │   └── api/scan/route.ts     # POST unique, streaming NDJSON
│   ├── components/
│   │   ├── dashboard/            # Dashboard (état client), ScanForm, ScanStatus,
│   │   │                         # SecurityReport, LiveSimulator
│   │   └── ui/                   # Button, Input, Card, Badge, Progress (à la main)
│   ├── hooks/
│   │   └── useAnimatedNumber.ts  # count-up (~800 ms) accessible
│   ├── lib/
│   │   ├── env.ts                # validation zod des variables (server-only)
│   │   ├── score.ts              # computeScore, getScoreTier
│   │   ├── sleep.ts              # temporisation annulable + isAbortError
│   │   ├── utils.ts              # cn (clsx + tailwind-merge)
│   │   └── validation.ts         # schémas partagés client/serveur
│   ├── services/
│   │   ├── scanService.ts        # scan simulé du dépôt (server-only)
│   │   └── testService.ts        # parcours d'achat simulé (server-only)
│   └── types/index.ts            # schémas zod + types inférés + isScanEvent
```

Le composant `Dashboard` est le seul propriétaire de l'état client. Les
composants n'importent **jamais** les services : uniquement des types, des
schémas et des utilitaires de `src/lib`. Le protocole (`ScanEvent`, NDJSON,
une ligne par événement) est le contrat stable entre la route API et le
client.

## Déclencheurs de démo (scénarios de recette)

| Action | Résultat attendu |
| --- | --- |
| URL de dépôt valide + URL de production vide | parcours complet jusqu'à « Terminé », hôte de production aléatoire 50/50 pour l'étape 4 |
| Dépôt `https://github.com/demo/not-found` | bandeau d'erreur `REPO_NOT_FOUND`, pas de parcours d'achat |
| Dépôt `https://github.com/demo/boom` | bandeau `INTERNAL_ERROR` générique, aucune stack trace visible |
| URL de production `https://fail.example.com` | étape 4 en FAILED, bandeau d'alerte, score réduit de 10 points |
| URL de production `https://ok.example.com` | étape 4 en SUCCESS |
| Clic sur « Annuler » en plein scan | statut « Analyse annulée », résultats partiels conservés, aucune erreur affichée |
| URL GitHub invalide | message de validation sous le champ, aucune requête envoyée |

Barème du score : `100 − 15 × (nb CRITICAL) − 5 × (nb WARNING) − 10 si
l'étape 4 échoue`, plancher à 0. Les constats « OK » ne pénalisent pas.

## Note de sécurité

GuardVibe est une démonstration. Ne scannez que des dépôts et des sites dont
vous êtes propriétaire ou pour lesquels vous disposez d'une autorisation
explicite. Aucune clé réelle ne doit être ajoutée au code ; les rapports
affichent uniquement des placeholders évidents (`sk_test_<REDACTED>`).

## Passer du mode démo aux vrais scans

L'interface, les contrats (`src/types`) et la route API n'ont **pas** besoin
d'être modifiés. Remplacez uniquement :

- `src/services/scanService.ts` : parcourir le dépôt réel (API GitHub ou
  clone), émettre les mêmes événements (`scan_started`, `progress`, `finding`,
  `error`) avec les mêmes plages de progression ;
- `src/services/testService.ts` : piloter un vrai navigateur automatisé
  (Playwright) contre l'URL de production, émettre `test_step` et `progress`.

Contra**int**s d'implémentation à conserver :

- signatures inchangées :
  `scanRepository(input: { repoUrl: string }, range: ProgressRange, signal: AbortSignal)` ;
  `runPurchaseJourney(input: { productionUrl: string }, range: ProgressRange, signal: AbortSignal)` ;
- respecter `range` (interpolation linéaire 0→60 pour le scan, 60→100 pour le
  parcours) ;
- se terminer proprement à l'annulation (les `AbortSignal` sont déjà câblés à
  la requête HTTP par la route) ;
- secrets uniquement côté serveur via `src/lib/env.ts` (jamais de préfixe
  `NEXT_PUBLIC_` sur une clé : cette variable serait embarquée dans le
  JavaScript du navigateur) ;
- toute erreur métier est émise comme événement `error` (codes : `INVALID_URL`,
  `REPO_NOT_FOUND`, `INTERNAL_ERROR`), jamais comme exception visible côté
  client.
