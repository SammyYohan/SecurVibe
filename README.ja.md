# SecurVibe

[![CI](https://github.com/SammyYohan/SecurVibe/actions/workflows/ci.yml/badge.svg)](https://github.com/SammyYohan/SecurVibe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2d5a88.svg)](./LICENSE)
[![Donate on Ko-fi](https://img.shields.io/badge/Donate-Ko--fi-29ABE0?logo=ko-fi&logoColor=white)](https://ko-fi.com/sammyyohan)
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-00457C?logo=paypal&logoColor=white)](https://paypal.me/sammyyohan)

**AIで構築したSaaSのための本物のセキュリティ監査** — GitHubスキャナー + 本番環境監査を約60秒で、100%無料、アカウント不要。

🌍 [English](./README.md) | [Français](./README.fr.md) | [Español](./README.es.md) | [Deutsch](./README.de.md) | [Português (BR)](./README.pt-br.md) | **日本語** | [简体中文](./README.zh-cn.md) | [العربية](./README.ar.md)

> 🌐 インターフェースは8言語で利用できます: English · Français · Español · Deutsch · Português (BR) · 日本語 · 简体中文 · العربية (RTL)。
> 監査の指摘と修正内容は英語で提供されます — セキュリティツールの標準だからです — どの言語でもそのまま英語で表示されます。

---

## なぜSecurVibeを作ったのか

私は**SammyYohan**です。以前はITエンジニア兼開発者でしたが、今はバイブコーディング(vibe coding) — AIと手を携えて、まるで共作のようにソフトウェアを作っていくやり方 — に転換しました。現在はガボンのリーブルビル(Libreville)に住み、仕事のない時期にあります。プロジェクトを作り続けることが、私を前へ進める力になっています。私が情熱を注いでいるのはAI、新しい技術、そしてゲーム。SecurVibeが生まれたのは、まさにこの三つの組み合わせが交わるところでした。

このツールが解決する問題はこうです。今日では誰もがAIに書かせたコードを出荷しています。たいていはチャットウィンドウからそのまま持ってきたもので、その出力を確認するための道具は何もありません。しっかりしたセキュリティツールは確かに存在します — CIプラットフォーム、SASTスイート、エンタープライズ向けダッシュボード — しかし、それらは企業の予算をターゲットにしています。個人開発者(あるいは私のように仕事を探している期間にある人)には、たった一つのシンプルな問いに無料で、登録なし、アカウントなしで答える手段がありませんでした:*「AIが今まさに作ったものは、本当に公開しても安全なのか?」*

SecurVibeはその答えです。本物の監査(シークレット情報、脆弱な依存関係、TLS、セキュリティヘッダー)、スコア、そしてどんなコーディングエージェントにもそのまま貼り付けられる修正リスト — すべての人に無料で提供します。

---

## 実際に検査する(シミュレーションではありません)

| モジュール | 検査内容 | データソース |
| --- | --- | --- |
| **リポジトリスキャナー** | ハードコードされたシークレット(GitHub PAT、Stripe/OpenAI/Anthropic/Slack/GitLabキー、AWS、PEM秘密鍵、署名済みJWT、データベースURL)、リスクに基づく優先順位付け、最大200ファイル | `raw.githubusercontent.com` 経由で実際のコンテンツを取得 + GitHub APIへのフォールバック |
| **依存関係** | ロックファイル(`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`)で解決された正確なバージョンに基づく、深刻度付きの実CVE/GHSAアドバイザリ(OSV.dev) | [OSV.dev](https://osv.dev)(公開・無料・キー不要) |
| **衛生状態** | コミットされた `.env` ファイル、`.gitignore` 内の `.env*` 除外設定、ロックファイル、CIワークフロー、パスワードハッシュ化ライブラリ(bcrypt/argon2) | リポジトリツリー + ファイル |
| **本番環境監査** | HTTPS到達性、HTTP→HTTPSリダイレクト、TLS証明書(残り日数、実際のハンドシェイク)、6つのセキュリティヘッダー(CSP、HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy) | 送信されたURLへのHTTPリクエスト + `tls.connect` |

**スコア**: `100 − 15 × 重大 − 5 × 警告 − 10 × (本番環境監査の決定的ステップの失敗)`。重大な指摘が1件あると、スコアは79で頭打ちになります。すべての指摘には説明と、そのままコピー&ペーストできる修正内容が付きます。

### 修正ループ(すべてブラウザ内で完結)

1. **「AIへの指示をコピー」**(任意) — [OpenRouter](https://openrouter.ai) 経由のLLMレビューが、指摘内容を分かりやすい分析と、コーディングエージェントにそのまま貼り付けられる1つの指示に変換します。
2. **「修正リスト(Markdown)をコピー」** — Cursor / Claude Code / Copilot にそのまま貼り付けられるチェックリスト。各指摘が `- [ ]` 項目とその修正になり、その後、再監査で確認します。
3. **ローカルの傾向** — スコアは**同じターゲット**(リポジトリ + 本番URL)の前回の監査と比較されます: `↗ +X` / `↘ −X` / `=`。履歴は `localStorage` に保存されます(直近50回分。サーバーにデータは送られず、トークンは決して保存しません)。
4. **「修正後の再監査」** — ワンクリックで、同じターゲットを同じパラメータで再実行します。

---

## スタック

> 🎨 デザインシステム(パレット、タイポグラフィ、コンポーネント)は [`DESIGN.md`](./DESIGN.md) にまとめています。

- **Next.js 16**(App Router、RSC)、**React 19**、**TypeScript strict**
- **Tailwind CSS v4**、lucide-react、独自実装のUIコンポーネント(重い外部ライブラリは不使用)
- **zod** によるすべてのコントラクト定義(クライアント/サーバーでスキーマを共有)
- **NDJSON** ストリーミングと、伝播するキャンセル(`AbortSignal`/`AbortSignal.any`)
- データベースなし、アカウントなし、サーバー側の保存なし
- クォータは **Upstash Redis**(ステートレスなREST API)で管理し、メモリへ自動フォールバック
- pnpmのみ(Node ≥ 20.9)

```bash
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm dev          # development
pnpm build && pnpm start
pnpm lint && pnpm typecheck
```

---

## 構成

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

## ビジネスモデルとフェアユースのクォータ

SecurVibeは**100%無料 — 登録不要、広告なし、テレメトリなし**です。

フェアユースのクォータがインフラを守り、誰もが引き続き使えるようにしています:

| クォータ | 上限 | 説明 |
| --- | --- | --- |
| **毎分** | 6監査 | IPごとのスライディングウィンドウ(バースト対策) |
| **1日あたり** | 30監査 | IPごと、UTC 24時間の区切りごと |
| **グローバル上限** | 1,000監査 | サービス全体で1日あたり |
| **同時実行** | 3同時 | サーバーインスタンスごと(メモリ/CPUのガードレール) |
| **深度** | 200ファイル | GitHubリポジトリの1監査ごと |

クォータはUpstash Redis(RESTパイプライン、`sv:` プレフィックスのキー)でチェックされ、ストアに到達できない場合は(「fail-open」)自動的にローカルメモリへフォールバックします。

---

## 設定

すべての変数は**任意**です([`.env.example`](./.env.example) を参照):

| 変数 | 役割 |
| --- | --- |
| `GITHUB_TOKEN` | ユーザーが自分のトークンを提供しない場合のサーバー側クォータ 60→5,000リクエスト/時 |
| `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | 共有クォータストア(Upstash、REST API) |
| `OPENROUTER_API_KEY` | 任意: レポート内の「AIで分析」レビューを有効化 |
| `OPENROUTER_MODEL` | 任意: レビューに使うモデル(デフォルト: `openai/gpt-4o-mini`) |
| `NEXT_PUBLIC_SITE_URL` | 正規URL + hreflang(OpenRouterの `HTTP-Referer` にも使用) |
| `CONTACT_EMAIL` | 法的ページに表示される連絡先メールアドレス |

**ユーザートークン**: スキャンフォームの任意フィールド。現在のリクエストでの転送にのみ使われ、サーバー側にもクライアント側にも保存されません。

---

## 製品のセキュリティ

- **厳格なアンチSSRF保護**(`ssrf.ts`): DNS解決のチェック、プライベートレンジのブロック(10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、127.0.0.0/8、リンクローカル、マルチキャスト、クラウドメタデータIPv4/IPv6)、DNSリバインディングを無効化するためのIPピン留め接続。
- いかなるストリーミングの**前にも**厳格なバリデーション(スタックトレースを漏らさないJSON 400)。
- すべての環境変数はzodスキーマ経由で読み込み、シークレットは `NEXT_PUBLIC_` 経由で絶対に露出しません。
- 多層的なリミッター(分、日、同時実行、グローバル)。
- `AbortSignal` によるクリーンなストリームのキャンセル。

---

## デプロイ(Vercel + Upstash)

1. `pnpm build`(8言語すべてでページを静的に事前生成)。
2. ホスティング環境(VercelまたはNode)で任意の環境変数を設定します。
3. 共有クォータを使う場合: [Upstash](https://upstash.com) → Redisデータベースを作成(RESTを有効化) → `UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN` をコピーします。
4. すべて準備済みです: i18n、SEO(hreflang + カノニカル)、アンチSSRF、NDJSONストリーミング(`/api/scan` には `maxDuration = 60` を設定済み)。

---

## コントリビューション

コントリビューションを歓迎します:

1. フォークし、`main` からブランチを作成します。
2. `pnpm install`(Node ≥ 20.9、pnpmはcorepack経由)。
3. `pnpm dev` でローカルアプリを起動 — `/en/app` がダッシュボードです。
4. CIをグリーンに保ちます: `pnpm typecheck && pnpm lint && pnpm build`(push/PRごとに実行 — `.github/workflows/ci.yml` を参照)。
5. コメントは英語で書きます。ユーザー向けの文言は `src/lib/i18n/dictionaries/` の8つの辞書を通します。
6. 説明を明確にしてPRをオープンします。

---

## フォーク

自分のデプロイのためにSecurVibeをフォークすることは、まさにMITライセンスが意図した使い方です: [`LICENSE`](./LICENSE) ファイルを保持し、自分のインスタンスをデプロイし、ユーザーに対しては100%無料のままで — ペイウォールの仕組みは一切組み込まれていません。

---

## 私の活動を支援する

SecurVibeは100%無料であり、これからもそうあり続けます。もし時間の節約になった — あるいは単に私の作るものが好きだという場合は — [Ko-fi](https://ko-fi.com/sammyyohan) や [PayPal.me](https://paypal.me/sammyyohan) で私の活動を支援できます。

寄付はすべて、このツールのホスティング費用と次の無料プロジェクトに充てられます。完全に任意です。寄付の有無で機能が制限されることはなく、寄付がなくてもツールは完全に動作します。

---

## ライセンス

[MIT](./LICENSE) — 使用・改変・再配布は自由です。
