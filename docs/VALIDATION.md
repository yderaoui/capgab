# Validation — 19 October 2026

Validated locally on Windows PowerShell, Node 24.11.1, Next.js 16.4.2, React 19.3.1. No Supabase, private signing key, RPC credentials, or email credentials were supplied.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no warnings |
| `npm test` | 37 tests passed across 5 files |
| `npm run build` | Passed; static pages, dynamic Node handlers, auth proxy generated |
| Production Playwright suite | 6 tests passed, Chromium, 26 seconds |
| `npm run test:smoke` | DexScreener 200, GeckoTerminal 200, Jupiter 200 without taker/transaction |
| Full application live scan | Wrapped SOL resolved, 9 decimals, 30 DexScreener snapshots and 20 GeckoTerminal pools, amount-specific Jupiter Metis quote returned |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Full dependency audit | 5 high development-tool findings through Next ESLint → fast-glob → micromatch → braces; no fixed braces release was available during validation |

Unit/integration coverage includes public-key validation, exact atomic conversion beyond JavaScript safe integers, token precision rejection, high-precision valuation, favorable negative gaps, missing and zero inputs, USD conversion, pool/quote-asset/time matching, diagnostic rules, mocked provider HTTP calls, source cache timestamps, quote asset/amount validation, optional fee fields, 429 behavior, canonicalization, hashing, Ed25519 signatures, tampering, alert thresholds and cooldown keys.

Database tests run the actual migration against PGlite (embedded PostgreSQL WASM) with a minimal Supabase auth-schema fixture. They verify owner read/update isolation, rejection of demo contamination, immutable receipts/public keys, public-function privilege restrictions, atomic rate limits, alert-to-job creation, lease idempotency, insufficient analytics, and owner detachment on account deletion without altering signed evidence. These tests do not run Supabase Auth, its hosted PostgREST gateway, pg_cron, Vault, or pg_net.

Production browser tests cover homepage and invalid input, desktop/mobile navigation, amount-specific demo updates, separate sensitivity requests, comparison rendering, local watchlist save, server-side demo receipt issuance, browser signature verification, real JSON downloads, PNG signature and exact 1200×630 dimensions, uploaded JSON tampering, no-route handling, local alert save/delete, unauthenticated private API rejection, invalid payloads, cross-origin rejection, all main routes, and mobile scanner/receipt viewport bounds. Desktop and 390px mobile screenshots are written to ignored `test-results/`; the downloaded evidence image is `test-results/receipt-card.png`.

The first browser checks exposed cold development-compilation timing and a selector collision with Next's route announcer. A later mobile assertion caught a real grid-width overflow; container minimum widths and the preview numerals were corrected. The final suite ran against `next start`, not the development server.

Live checks exposed a Jupiter response with `platformFee.feeBps` and `feeMint` but no `amount`. The adapter now preserves the missing fee amount as null while retaining the valid quote. Real output amounts change; this report intentionally does not advertise captured quotes as current market values. Both public market responses lacked source observation timestamps, so live direct price deviation was withheld as designed.

## Not validated / not production-certified

- Hosted Supabase email-link delivery, PKCE callback and session renewal with real accounts.
- Hosted multi-user persistence and PostgREST/RLS behavior (database-level policies were locally tested).
- Durable live receipt creation, retrieval and key rotation against a real Supabase project.
- Supabase Vault/pg_net/cron scheduling and real monitoring runs.
- Resend delivery and sender-domain setup.
- Configured RPC mint inspection and unusual Token-2022 extensions against mainnet fixtures.
- Long-running historical collection, large-scale distributed quotas, or independent source-freshness benchmarks.
- A deployed Vercel site. No external service was configured or published.

These require deployment credentials and staging acceptance tests. See README next priorities and DEPLOYMENT.md. Local receipt previews and demo alert configuration must not be described as durable public evidence or active background monitoring.
