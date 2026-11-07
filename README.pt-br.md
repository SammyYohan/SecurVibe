# SecurVibe

[![CI](https://github.com/SammyYohan/SecurVibe/actions/workflows/ci.yml/badge.svg)](https://github.com/SammyYohan/SecurVibe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2d5a88.svg)](./LICENSE)
[![Donate on Ko-fi](https://img.shields.io/badge/Donate-Ko--fi-29ABE0?logo=ko-fi&logoColor=white)](https://ko-fi.com/sammyyohan)
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white)](https://paypal.me/sammyyohan)

**Auditorias de segurança reais para SaaS construídos com IA** — scanner do GitHub + auditoria de produção, em ≈ 60 segundos, 100% gratuito, sem conta.

🌍 [English](./README.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [Deutsch](./README.de.md) | **Português (BR)** | [日本語](./README.ja.md) | [简体中文](./README.zh-cn.md) | [العربية](./README.ar.md)

> 🌐 Interface disponível em 8 idiomas: English · Français · Español · Deutsch · Português (BR) · 日本語 · 简体中文 · العربية (RTL).
> As conclusões de auditoria e as correções ficam em inglês — o padrão das ferramentas de segurança — e são exibidas em todos os idiomas.

---

## Por que criei o SecurVibe

Sou **SammyYohan** — ex-profissional de TI e desenvolvedor que migrou para o vibe coding: construir software lado a lado com a IA. Moro em Libreville, no Gabão, e estou atualmente sem emprego — criar projetos é o que me mantém seguindo em frente. Sou apaixonado por IA, novas tecnologias e games — e foi exatamente dessa mistura que nasceu o SecurVibe.

O problema que ele resolve: hoje todo mundo publica código escrito com IA, quase sempre direto de uma janela de chat, sem ferramenta nenhuma para verificar o que sai de lá. Ferramentas de segurança sólidas existem — plataformas de CI, suítes SAST, dashboards corporativos — mas foram pensadas para orçamentos de empresa. Para um dev independente (ou alguém sem emprego como eu), não havia um jeito gratuito, sem cadastro e sem conta de responder a uma pergunta bem simples: *“O que a minha IA acabou de construir é realmente seguro para publicar?”*

O SecurVibe é essa resposta: auditorias reais (segredos, dependências vulneráveis, TLS, cabeçalhos de segurança), uma pontuação e uma lista de correções pronta para colar em qualquer agente de código — gratuito para todo mundo.

---

## Verificações reais (sem simulação)

| Módulo | O que é verificado | Fonte de dados |
| --- | --- | --- |
| **Scanner de repositório** | Segredos hardcoded (PATs do GitHub, chaves Stripe/OpenAI/Anthropic/Slack/GitLab, AWS, chaves PEM privadas, JWTs assinados, URLs de banco de dados), priorização por risco, até 200 arquivos | Conteúdo real via `raw.githubusercontent.com` + fallback na API do GitHub |
| **Dependências** | Avisos CVE/GHSA reais com nível de severidade (OSV.dev) a partir das versões exatas resolvidas no lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) | [OSV.dev](https://osv.dev) (base pública gratuita, sem chave) |
| **Higiene** | Arquivos `.env` commitados, exclusão `.env*` no `.gitignore`, lockfile, workflows de CI, bibliotecas de hash de senha (bcrypt/argon2) | Árvore do repositório + arquivos |
| **Auditoria de produção** | Acessibilidade HTTPS, redirecionamento HTTP→HTTPS, certificado TLS (dias restantes, handshake real), 6 cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | Requisições HTTP + `tls.connect` para a URL enviada |

**Pontuação**: `100 − 15 × críticos − 5 × avisos − 10 × (falha da etapa decisiva da auditoria de produção)`. Uma conclusão crítica limita a pontuação a 79. Cada conclusão vem com uma explicação e uma correção pronta para copiar e colar.

### Ciclo de correção (100% no navegador)

1. **“Copiar a instrução para a IA”** (opcional) — uma revisão por LLM (via [OpenRouter](https://openrouter.ai)) transforma as conclusões em uma análise clara e em uma única instrução pronta para colar no seu agente de código.
2. **“Copiar a lista de correções (Markdown)”** — uma checklist pronta para colar no Cursor / Claude Code / Copilot: cada conclusão vira um item `- [ ]` com a sua correção, e depois basta reauditar para verificar.
3. **Tendência local** — a pontuação é comparada com a auditoria anterior **no mesmo alvo** (repo + URL de produção): `↗ +X` / `↘ −X` / `=`. O histórico fica no `localStorage` (últimas 50 auditorias, sem dados no servidor, nunca o token).
4. **“Reauditar após as correções”** — um clique reexecuta o mesmo alvo com os mesmos parâmetros.

---

## Stack

> 🎨 O design system (paleta, tipografia, componentes) está documentado em [`DESIGN.md`](./DESIGN.md).

- **Next.js 16** (App Router, RSC), **React 19**, **TypeScript strict**
- **Tailwind CSS v4**, lucide-react, componentes de UI próprios (sem biblioteca externa pesada)
- **zod** para todos os contratos (schemas compartilhados cliente/servidor)
- Streaming **NDJSON** com cancelamento propagado (`AbortSignal`/`AbortSignal.any`)
- Sem banco de dados, sem conta, sem armazenamento no servidor
- Cotas via **Upstash Redis** (API REST sem estado) com fallback automático em memória
- Somente pnpm (Node ≥ 20.9)

```bash
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm dev          # development
pnpm build && pnpm start
pnpm lint && pnpm typecheck
```

---

## Estrutura

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx          ← root layout (lang/dir RTL, hreflang SEO)
│   │   ├── page.tsx            ← landing (hero, benefits, comparison, FAQ)
│   │   ├── pricing/page.tsx    ← permanent redirect to /app (product is free)
│   │   ├── legal/page.tsx      ← terms & privacy
│   │   ├── app/page.tsx        ← dashboard (scanner)
│   │   ├── error.tsx           ← localized error boundary
│   │   └── not-found.tsx
│   ├── api/scan/route.ts       ← POST NDJSON streaming (real, quotas, slots)
│   ├── api/ai-analysis/route.ts← POST optional AI review (OpenRouter)
│   └── globals.css
├── components/
│   ├── dashboard/              ← Dashboard, ScanForm, ScanStatus, SecurityReport,
│   │                             SiteAuditPanel
│   ├── site/                   ← LocaleSwitcher, SiteFooter, Logo, SectionHeading
│   └── ui/                     ← in-house primitives (Button, Badge, Card, Input…)
├── lib/
│   ├── i18n/                   ← locale config, 8 typed dictionaries, engine
│   ├── env.ts                  ← validated server variables (zod)
│   ├── validation.ts           ← shared request schemas (zod)
│   ├── score.ts                ← score formula (capped at 79 on critical)
│   ├── rateLimit.ts            ← per-instance in-memory limiter
│   ├── quota.ts                ← shared Upstash Redis quotas + memory fallback
│   ├── lockfile.ts             ← npm/pnpm/yarn lock version resolver
│   ├── secrets.ts              ← secret detection rules & guidance
│   ├── ssrf.ts                 ← anti-SSRF URL validation (DNS, private IPs)
│   └── plans.ts                ← quota constants and audit limits
├── services/
│   ├── scanService.ts          ← repository scanner (GitHub raw + rules + OSV.dev)
│   ├── siteService.ts          ← production audit (HTTPS, TLS, headers)
│   └── vulnClient.ts           ← OSV.dev client (batch + severity)
├── types/index.ts              ← zod contracts (ScanEvent, Finding, TestStep…)
└── proxy.ts                    ← Accept-Language negotiated redirect (Next 16)
```

---

## Modelo de negócio & cotas de uso justo

O SecurVibe é **100% gratuito — sem cadastro, sem anúncios, sem telemetria**.

Cotas de uso justo protegem a infraestrutura e a mantêm disponível para todos:

| Cota | Limite | Descrição |
| --- | --- | --- |
| **Por minuto** | 6 auditorias | Janela deslizante por IP (proteção contra rajadas) |
| **Por dia** | 30 auditorias | Por IP e por fatia UTC de 24 h |
| **Teto global** | 1.000 auditorias | Por dia para o serviço inteiro |
| **Concorrência** | 3 simultâneas | Por instância do servidor (proteção de memória/CPU) |
| **Profundidade** | 200 arquivos | Por auditoria de repositório do GitHub |

As cotas são verificadas via Upstash Redis (pipeline REST, chaves com o prefixo `sv:`) e caem automaticamente para memória local quando o armazenamento fica indisponível (“fail-open”).

---

## Configuração

Todas as variáveis são **opcionais** (ver [`.env.example`](./.env.example)):

| Variável | Função |
| --- | --- |
| `GITHUB_TOKEN` | Cota do servidor 60→5.000 requisições/h quando o usuário não fornece a dele |
| `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | Armazenamento compartilhado das cotas (Upstash, API REST) |
| `OPENROUTER_API_KEY` | Opcional: habilita a revisão “Analisar com IA” no relatório |
| `OPENROUTER_MODEL` | Opcional: modelo da revisão (padrão: `openai/gpt-4o-mini`) |
| `NEXT_PUBLIC_SITE_URL` | URL canônica + hreflang (também o `HTTP-Referer` do OpenRouter) |
| `CONTACT_EMAIL` | Endereço de contato exibido na página legal |

**Token do usuário**: campo opcional no formulário de scan, enviado apenas durante a requisição atual, nunca armazenado no servidor nem no cliente.

---

## Segurança do produto

- Proteção **anti-SSRF estrita** (`ssrf.ts`): verificação das resoluções DNS, bloqueio de faixas privadas (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, link-local, multicast, metadados de cloud IPv4/IPv6), conexões com IP fixado para neutralizar o DNS rebinding.
- Validação estrita **antes** de qualquer streaming (JSON 400 sem vazamento de stack trace).
- Todas as variáveis de ambiente lidas por meio de um schema zod; segredos nunca expostos via `NEXT_PUBLIC_`.
- Limitadores em camadas (minuto, dia, concorrência, global).
- Cancelamento limpo dos fluxos via `AbortSignal`.

---

## Deploy (Vercel + Upstash)

1. `pnpm build` (páginas pré-geradas estaticamente para os 8 idiomas).
2. Configure as variáveis de ambiente opcionais no seu host (Vercel ou Node).
3. Para cotas compartilhadas: [Upstash](https://upstash.com) → crie um banco de dados Redis (REST habilitado) → copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
4. Tudo está pronto: i18n, SEO (hreflang + canônica), anti-SSRF, streaming NDJSON (`maxDuration = 60` está definido para `/api/scan`).

---

## Contribuir

Contribuições são bem-vindas:

1. Faça um fork e crie uma branch a partir de `main`.
2. `pnpm install` (Node ≥ 20.9, pnpm via corepack).
3. `pnpm dev` para a aplicação local — `/en/app` é o dashboard.
4. Mantenha a CI verde: `pnpm typecheck && pnpm lint && pnpm build` (roda a cada push/PR — ver `.github/workflows/ci.yml`).
5. Os comentários são escritos em inglês; os textos voltados para usuários passam pelos 8 dicionários em `src/lib/i18n/dictionaries/`.
6. Abra uma PR com uma descrição clara.

---

## Fork

Fazer um fork do SecurVibe para o seu próprio deploy é exatamente o que a licença MIT permite: mantenha o arquivo [`LICENSE`](./LICENSE), faça o deploy da sua própria instância e continue 100% gratuito para os seus usuários — nenhuma mecânica de paywall está embutida.

---

## Apoie meu trabalho

O SecurVibe é 100% gratuito e vai continuar assim. Se ele te economizou tempo — ou se você simplesmente gosta do que eu construo —, você pode apoiar meu trabalho no [Ko-fi](https://ko-fi.com/sammyyohan) ou no [PayPal.me](https://paypal.me/sammyyohan).

Cada doação vai para os custos de hospedagem desta ferramenta e do próximo projeto gratuito. Completamente opcional: nada fica bloqueado por trás disso, a ferramenta está completa sem isso.

---

## Licença

[MIT](./LICENSE) — livre para usar, modificar e redistribuir.
