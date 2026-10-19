# CAPGAP

**The chart says you're rich. Can you actually cash out?**

CAPGAP compares Solana market observations with a quote for selling an exact token quantity into USDC. It is read-only: no wallet connection, signing, transaction execution, token deployment, or referral swaps.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open the printed localhost URL (usually port 3000; Next selects another free port when needed). No environment variables are required for the demo or public provider requests. Open `/scan?demo=poor` for the full demonstration.

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Playwright starts/reuses port 3001; set `PLAYWRIGHT_BASE_URL` for an existing deployment. Routine automated tests use deterministic fixtures and mocks, never live providers. `npm run test:smoke` makes optional real network requests. SQL migration/RLS tests run against an embedded PostgreSQL WASM runtime, with a minimal mock of Supabase's auth schema; they do not certify a hosted Supabase configuration.

## Implemented

- Next.js App Router, strict TypeScript, Tailwind, shadcn-compatible Radix button, Lucide, Motion, Recharts, TanStack Query, Zustand.
- Responsive landing page and all requested scanner, token, compare, evidence, watchlist, alert, analytics, dashboard, settings, explanation, and methodology routes; additional docs/privacy/terms pages.
- Valid base58 public-key input using the current Solana address package. Mint existence is resolved from provider metadata and optionally verified via RPC. No pricing/decimals are guessed when providers fail.
- Independent DexScreener and GeckoTerminal adapters, validated payloads, same-pool matching, pool selection, cached original retrieval times, timeouts, bounded retries, and explicit errors.
- Jupiter Swap V2 `GET /order` **without taker**, into official Solana USDC only. Exact BigInt atomic inputs and high-precision decimal calculations. Missing fees stay unknown. Transactions returned upstream are never exposed, used, or persisted.
- USD/token inputs, actual amount-specific quotes, five-size sensitivity chart, transparent diagnostics, source comparison, timestamps, and limitations.
- Seven labeled fictional scenarios: poor and healthy liquidity, provider mismatch, no route, stale data, liquidity collapse, and greater position-size sensitivity. No fabricated live history.
- Canonical JSON receipts, SHA-256, Ed25519 signatures, independent browser verification and uploaded-file tamper detection, JSON downloads and server-rendered 1200×630 PNGs.
- Browser-local demo watchlists, alert configuration, history, and receipts. Demo alerts do **not** run in the background.
- Supabase-backed email-link authentication, private CRUD with RLS, append-only public live receipts, scheduled monitoring handler, optional email code path, and historical aggregation when configured.

## Demo separation

Demo prices and quotes are fictional, with a deterministic reserve curve. Demo mode uses the production calculation and visualization code, but bypasses real providers and production persistence. Browser storage is named `capgap-demo-v1`. Server demo receipts use an ephemeral Ed25519 key and process memory. The browser retains a JSON copy; a demo receipt URL or image can expire after a server restart and is not durable public evidence. Export JSON to preserve a preview. Production database constraints reject demo observations and receipts.

The homepage slider is an explicitly labeled illustrative preview; real analysis never scales a previous quote.

## Configuration

Copy `.env.example` to `.env.local` and fill only the integrations you need. No secrets should be committed.

| Variable                        | Purpose                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | App origin for auth redirects and origin checks                                  |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous/publishable API key; RLS is mandatory                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only persistence, monitoring, rate-limit operations                       |
| `JUPITER_API_KEY`               | Optional server-only Jupiter quota; keyless availability depends on the provider |
| `SOLANA_RPC_URL`                | Optional trusted server-configured RPC for mint owner, decimals, extensions      |
| `RECEIPT_SIGNING_PRIVATE_KEY`   | Server-only Ed25519 PKCS8 PEM, literal `\n` accepted                             |
| `RECEIPT_KEY_ID`                | Immutable public signing-key identifier                                          |
| `MONITOR_SECRET`                | Long random bearer secret for the monitoring endpoint                            |
| `RESEND_API_KEY`, `EMAIL_FROM`  | Optional verified email sender                                                   |
| `ALLOW_MEMORY_RATE_LIMIT`       | Set `true` only for an explicitly accepted single-instance production fallback   |

Generate a signing key using `node scripts/signing-key.mjs` in a trusted local terminal. The command prints the private key for secure environment-variable provisioning; do not put its output in logs or commit it. Retain old public keys and use a new key ID for each rotation.

## Supabase, monitoring, email

1. Create a Supabase project and apply `supabase/migrations/202610190001_capgap.sql` using the SQL editor or Supabase migration tooling.
2. Enable email authentication. Configure the site URL and allow `/auth/callback` for your exact development and production origins. Use a production SMTP provider for real public accounts.
3. Set the public Supabase variables and server service-role key. Restart/rebuild to pick up public environment changes.
4. Sign in at `/settings`; save live tokens and alerts. RLS restricts private records to their owner. Live receipt issuance also requires a signing key.
5. To enable monitoring, provision `MONITOR_SECRET`, enable Supabase `pg_cron`, `pg_net`, and Vault, and store `capgap_app_url` and `capgap_monitor_secret` in Vault. Apply `supabase/monitoring.sql` separately. Never put literal secrets in committed SQL.
6. Jobs run in batches of three, with a target 15-minute token interval and 5-minute leases. This is a small-deployment queue; backlogs and provider limits extend collection intervals. Avoid overlapping independent workers.
7. For email, configure Resend and a verified sender, opt in at settings, and enable email on each alert. In-app events persist without email. Delivery failures are recorded; automatic email retries are not yet implemented.

Alerts on the same mint currently share one monitoring position per account, selected from the oldest enabled rule. Configure a consistent position until per-position job identities are added. Liquidity-drop and gap-increase rules require a previous successful run.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Import this repository into Vercel as a **Next.js** project, configure production variables, apply the Supabase migration, run the quality checks and build, and deploy. The framework routes use the Node runtime. Do not use static export. No hosted deployment or external service configuration is performed automatically by this repository.

## Verification and known limits

See [docs/VALIDATION.md](docs/VALIDATION.md) for results from this build. [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [METHODOLOGY.md](METHODOLOGY.md), and [SECURITY.md](SECURITY.md) describe the contracts.

- Live market adapters can report successful public requests, but availability changes. Routine tests do not assume provider uptime.
- The public market responses currently do not expose a reliable observation timestamp. Snapshots are shown side by side; live direct discrepancy percentages are withheld. Retrieval time is never substituted for source observation time.
- RPC is optional. Without verified metadata decimals, no quote is requested. Token-2022 account details are inspected with RPC, but transfer fees, hooks, frozen accounts, route execution success, and all transaction costs are not independently simulated.
- Quoted USDC output is not guaranteed, and USD conversion can use a disclosed $1 approximation.
- Signatures authenticate preserved content, not provider truthfulness. Live receipt persistence/authentication/cron/email need deployment credentials and separate environment validation before being described as production-ready.
- Historical analytics uses actual stored retrievals only, with at least 10 samples per provider. Personal gap charts group actual scans by exact token quantity, pool, mode, and conversion context; insufficient histories remain empty. Same-pool divergence timelines likewise require stored comparable observations.
- No price OHLCV chart or trade feed is implemented. No historical data is invented to fill those areas.
- Large-scale distributed provider scheduling, transactional event delivery, alert recovery notifications, email retries, account deletion UI, configurable monitoring intervals, independent source-freshness benchmarks, and detailed per-position history remain future work.
- Draft privacy/terms need deployment operator identity, contact information, account deletion operations, and jurisdiction-specific review before broad public launch.

## Next priorities

1. Validate hosted Supabase email-link auth, RLS, durable live receipt issuance/retrieval, and cron in a staging deployment.
2. Add per-position jobs, provider-global quota coordination, transactional event delivery with email retries, and recovery transitions.
3. Collect aligned observations for longer time-series coverage and defensible source freshness statistics.
4. Expand verified Token-2022 fee/extension modeling and cost disclosures; add independent execution simulation only when supported.
5. Finalize operator contacts, deletion workflows, dependency advisory remediation, and external security review before public launch.

CAPGAP is research software. Market price, market cap, FDV, liquidity, price impact, slippage tolerance, quoted proceeds and realized proceeds are different measures. See the methodology. This is not financial advice.
