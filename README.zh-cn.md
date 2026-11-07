# SecurVibe

[![CI](https://github.com/SammyYohan/SecurVibe/actions/workflows/ci.yml/badge.svg)](https://github.com/SammyYohan/SecurVibe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2d5a88.svg)](./LICENSE)
[![Donate on Ko-fi](https://img.shields.io/badge/Donate-Ko--fi-29ABE0?logo=ko-fi&logoColor=white)](https://ko-fi.com/sammyyohan)
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white)](https://paypal.me/sammyyohan)

**为 AI 构建 SaaS 提供真实的安全审计** — GitHub 扫描器 + 生产环境审计，约 60 秒完成，100% 免费，无需账号。

🌍 [English](./README.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [Deutsch](./README.de.md) | [Português (BR)](./README.pt-br.md) | [日本語](./README.ja.md) | **简体中文** | [العربية](./README.ar.md)

> 🌐 界面提供 8 种语言：English · Français · Español · Deutsch · Português (BR) · 日本語 · 简体中文 · العربية (RTL)。
> 审计发现与修复建议均为英文——这是安全工具的通行标准——并在所有语言环境下以英文显示。

---

## 我为什么开发了 SecurVibe

我是 **SammyYohan**——曾是一名 IT 从业者和开发者，如今转向了 vibe coding(氛围编程)：与 AI 携手、手把手地一同开发软件。我住在加蓬的利伯维尔(Libreville)，目前处于待业状态——做项目是我继续前行的动力。我热爱 AI、新技术和游戏，SecurVibe 正是诞生于这三者的交汇点。

它解决的问题是这样的：如今人人都在交付用 AI 写出的代码，通常直接从聊天窗口复制出来，却没有任何工具去检查产出的结果。可靠的安全工具确实存在——CI 平台、SAST 套件、企业级仪表盘——但它们的定价瞄准的是企业预算。对于独立开发者(或者像我这样待业的人而言)，过去没有任何免费、无需注册、无需账号的方式，来回答一个非常简单的问题：*“我的 AI 刚构建出来的东西，真的可以放心上线吗？”*

SecurVibe 就是那份答案：真实审计(密钥泄露、受漏洞影响的依赖、TLS、安全响应头)、一个评分，以及一份专为任何编码智能体量身定制、即贴即用的修复清单——对所有人免费。

---

## 实打实的检查(绝非模拟)

| 模块 | 检查内容 | 数据来源 |
| --- | --- | --- |
| **仓库扫描器** | 硬编码的机密信息(GitHub PAT、Stripe/OpenAI/Anthropic/Slack/GitLab 密钥、AWS、PEM 私钥、已签名的 JWT、数据库 URL)、按风险排定优先级、最多 200 个文件 | 通过 `raw.githubusercontent.com` 获取真实内容 + GitHub API 兜底 |
| **依赖** | 基于锁文件(`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`)中解析出的精确版本、含严重等级的真实 CVE/GHSA 安全公告(OSV.dev) | [OSV.dev](https://osv.dev)(公开、免费、无需密钥) |
| **卫生检查** | 已提交的 `.env` 文件、`.gitignore` 中的 `.env*` 排除项、锁文件、CI 工作流、密码哈希库(bcrypt/argon2) | 仓库文件树 + 文件 |
| **生产环境审计** | HTTPS 可达性、HTTP→HTTPS 重定向、TLS 证书(剩余天数、真实握手)、6 个安全响应头(CSP、HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy) | 向提交的 URL 发送 HTTP 请求 + `tls.connect` |

**评分**：`100 − 15 × 严重 − 5 × 警告 − 10 × (生产环境审计关键步骤失败)`。出现一个严重(critical)发现会将评分封顶在 79。每条发现都附带说明和即贴即用的修复方式。

### 修复闭环(100% 在浏览器内完成)

1. **“复制 AI 指令”**(可选)—— 通过 [OpenRouter](https://openrouter.ai) 的 LLM 审查，把审计发现转化为一份清晰的分析，以及一条可直接粘贴给编码智能体的指令。
2. **“复制修复清单(Markdown)”** —— 可直接粘贴到 Cursor / Claude Code / Copilot 的清单：每个发现变成一个 `- [ ]` 条目及其修复方案，然后再重新审计验证。
3. **本地趋势** —— 评分会与**同一目标**(仓库 + 生产 URL)的上一次审计对比：`↗ +X` / `↘ −X` / `=`。历史保存在 `localStorage` 中(最近 50 次审计，无服务器端数据，绝不保存令牌)。
4. **“修复后重新审计”** —— 一键以相同参数重新审计同一目标。

---

## 技术栈

> 🎨 设计系统(配色、字体、组件)记录在 [`DESIGN.md`](./DESIGN.md) 中。

- **Next.js 16**(App Router、RSC)、**React 19**、**TypeScript strict**
- **Tailwind CSS v4**、lucide-react、自研 UI 组件(不引入重型的第三方库)
- **zod** 定义所有契约(客户端/服务器共享同一套 schema)
- **NDJSON** 流式输出，取消机制逐层传播(`AbortSignal`/`AbortSignal.any`)
- 无数据库、无账号、无服务器端存储
- 配额通过 **Upstash Redis**(无状态 REST API)管理，并自动降级到内存回退
- 仅使用 pnpm(Node ≥ 20.9)

```bash
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm dev          # development
pnpm build && pnpm start
pnpm lint && pnpm typecheck
```

---

## 项目结构

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

## 商业模式与公平使用配额

SecurVibe 是 **100% 免费的——无需注册、没有广告、没有遥测**。

公平使用配额保护基础设施，让人人都能继续使用：

| 配额 | 限制 | 描述 |
| --- | --- | --- |
| **每分钟** | 6 次审计 | 每个 IP 一个滑动窗口(防突发请求) |
| **每天** | 30 次审计 | 每个 IP、每个 UTC 24 小时切片 |
| **全局限额** | 1,000 次审计 | 整个服务每天 |
| **并发** | 3 并发 | 每个服务器实例(内存/CPU 护栏) |
| **深度** | 200 个文件 | 每个 GitHub 仓库审计 |

配额通过 Upstash Redis(REST pipeline、键前缀 `sv:`)校验，当存储不可达时自动回退到本地内存(“fail-open”)。

---

## 配置

所有变量均为**可选**(见 [`.env.example`](./.env.example))：

| 变量 | 用途 |
| --- | --- |
| `GITHUB_TOKEN` | 当用户未提供自己的令牌时，将服务端配额从 60 提升到 5,000 次/小时 |
| `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | 共享配额存储(Upstash，REST API) |
| `OPENROUTER_API_KEY` | 可选：启用报告中的“AI 分析”审查 |
| `OPENROUTER_MODEL` | 可选：审查所用的模型(默认：`openai/gpt-4o-mini`) |
| `NEXT_PUBLIC_SITE_URL` | 规范化 URL + hreflang(同时作为 OpenRouter 的 `HTTP-Referer`) |
| `CONTACT_EMAIL` | 法律页面展示的联系邮箱 |

**用户令牌**：扫描表单中的可选字段，仅在当前请求中转发，绝不储存在服务器端或客户端。

---

## 产品安全

- **严格的反 SSRF 防护**(`ssrf.ts`)：DNS 解析检查、阻止私有地址段(10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、127.0.0.0/8、链路本地、组播、云元数据 IPv4/IPv6)，并通过固定 IP 建立连接以化解 DNS 重绑定。
- 在**任何**流式输出之前进行严格校验(JSON 400，不泄露堆栈跟踪)。
- 所有环境变量都经 zod schema 读取；机密绝不通过 `NEXT_PUBLIC_` 暴露。
- 分层限流器(分钟、天、并发、全局)。
- 通过 `AbortSignal` 干净地取消流。

---

## 部署(Vercel + Upstash)

1. `pnpm build`(为 8 种语言静态预生成页面)。
2. 在托管环境(Vercel 或 Node)中设置可选的环境变量。
3. 共享配额：[Upstash](https://upstash.com) → 创建 Redis 数据库(启用 REST)→ 复制 `UPSTASH_REDIS_REST_URL` 与 `UPSTASH_REDIS_REST_TOKEN`。
4. 一切就绪：i18n、SEO(hreflang + canonical)、反 SSRF、NDJSON 流式(`/api/scan` 已设置 `maxDuration = 60`)。

---

## 参与贡献

欢迎贡献：

1. Fork 仓库，并从 `main` 新建分支。
2. `pnpm install`(Node ≥ 20.9，pnpm 经 corepack 提供)。
3. `pnpm dev` 启动本地应用——`/en/app` 是仪表盘。
4. 保持 CI 通过：`pnpm typecheck && pnpm lint && pnpm build`(每次 push/PR 都会运行——见 `.github/workflows/ci.yml`)。
5. 代码注释使用英文；面向用户的文案统一走 `src/lib/i18n/dictionaries/` 中的 8 个字典。
6. 提交 PR，并附上清晰的描述。

---

## Fork(派生)

Fork SecurVibe 用作自己的部署，这正是 MIT 许可证的用意所在：保留 [`LICENSE`](./LICENSE) 文件，部署你自己的实例，并保持对用户 100% 免费——代码中没有任何付费墙机制。

---

## 支持我的工作

SecurVibe 是 100% 免费的，也会一直免费下去。如果它帮你省了时间——或者你只是喜欢我正在打造的东西——欢迎在 [Ko-fi](https://ko-fi.com/sammyyohan) 或 [PayPal.me](https://paypal.me/sammyyohan) 上支持我的工作。

每一笔捐款都会用于这个工具的主机开销，以及下一个免费项目。完全自愿：没有任何功能被锁在捐款后面，没有捐款，工具本身也是完整的。

---

## 许可证

[MIT](./LICENSE)——可自由使用、修改与再分发。
