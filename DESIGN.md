# Design SecurVibe

Direction : **sobre, chaleureux, premium — pour les vibe coders.**
Fond clair ivoire sauge, un seul accent vert mousse, aucun bleu, aucun dégradé.

## Tokens (`src/app/globals.css`, bloc `@theme`)

| Token | Valeur | Usage |
| --- | --- | --- |
| `paper` / `paper-2` | `#F4F3ED` / `#ECEBE3` | Fond de page / survol discret |
| `card` | `#FBFAF6` | Surfaces (cartes, formulaires) |
| `line` / `line-strong` | `#E1DFD4` / `#CFCCBF` | Bordures fines / champs et boutons secondaires |
| `ink` / `mute` / `faint` | `#1E2420` / `#59615B` / `#6B736D` | Texte principal / secondaire / placeholders |
| `tint` | `#E6ECE3` | Aplat sauge (badges, bandeau CTA) |
| `accent` / `accent-hover` | `#2F5D4A` / `#264D3D` | Vert mousse : actions, score, liens actifs |
| `crit` / `crit-bg` | `#A83B28` / `#F6E5DF` | Brique : constats critiques |
| `warn` / `warn-bg` | `#8A5600` / `#F5EBD3` | Ocre : avertissements |
| `night` / `night-fg` | `#22281F` / `#E9EDE4` | Blocs de code |

Utilisation : `bg-paper`, `text-mute`, `border-line`, `bg-crit-bg`, `shadow-card`…
Tous les couples fond/texte utilisés respectent un contraste ≥ 4.5:1.
La gravité n'est jamais portée par la couleur seule : chaque constat a aussi une étiquette texte.

## Typographie

- **Manrope** (texte et titres) et **JetBrains Mono** (noms de fichiers, correctifs, données techniques), chargées via `next/font/google` dans `src/app/[locale]/layout.tsx`.
- Polices auto-hébergées par Next.js au build : aucun appel externe côté visiteur.

## Composants

- Primitives dans `src/components/ui/` (`Button`, `Badge`, `Card`, `Input`, `Progress`). `buttonVariants` s'applique aussi aux `<Link>`.
- Éléments partagés dans `src/components/site/` : `Logo`, `SectionHeading`, `LocaleSwitcher`, `SiteFooter`.
- Score affiché en anneau SVG (`ScanStatus`), constats en panneaux teintés par gravité (`SecurityReport`).

## Accessibilité

Focus clavier visible partout (`:focus-visible` global), `prefers-reduced-motion` respecté, propriétés CSS logiques (`start`/`end`, `ps`/`pe`) pour l'arabe (RTL).
