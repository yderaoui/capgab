# CAPGAP API v1

JSON responses, Node runtime. Monetary amounts are decimal strings, atomic amounts integer strings. Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }`. Status codes include 400 validation, 401 sign-in required, 403 rejected origin, 404 missing record, 409 conflict, 413 body too large, 429 throttled (`Retry-After`), and 503 missing integration.

`ScanInput` body (strict Zod validation; unknown fields rejected):

```json
{
  "mint": "So11111111111111111111111111111111111111112",
  "mode": "live",
  "amount": "1000",
  "input": "usd"
}
```

Optional `pool`: valid Solana pool address. `input`: `usd` or `tokens`. Defaults: `live`, `2000`, `usd`. Demo: `mode=demo`, mint `11111111111111111111111111111112`, scenario one of `poor`, `healthy`, `mismatch`, `no-route`, `stale`, `collapse`, `increasing`. No client-supplied quote payload is accepted.

| Method / endpoint                                 | Contract                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/health`                              | Basic app/config status, no secrets                                                                       |
| GET `/api/v1/token/{mint}`                        | Live Analysis for default position                                                                        |
| GET `/api/v1/token/{mint}/pools`                  | Normalized candidate snapshots                                                                            |
| GET `/api/v1/token/{mint}/compare`                | Pool comparison with comparability reason                                                                 |
| GET `/api/v1/token/{mint}/history?pool={address}` | Stored comparable observations for that exact token/pool                                                  |
| POST `/api/v1/scan`                               | ScanInput → full Analysis                                                                                 |
| POST `/api/v1/quote`                              | ScanInput → Analysis including validated quote                                                            |
| POST `/api/v1/exit-analysis`                      | ScanInput → amount-specific Analysis                                                                      |
| GET `/api/v1/receipts`                            | Public live receipt explorer                                                                              |
| POST `/api/v1/receipts`                           | ScanInput → fresh server-collected signed receipt; live requires auth/storage/key                         |
| GET `/api/v1/receipts/{uuid}`                     | Receipt JSON; demo preview if still in this process                                                       |
| GET `/api/v1/receipts/{uuid}/verify`              | Recomputed hash/signature verification of stored record                                                   |
| GET `/api/v1/keys/{keyId}`                        | Immutable registered public signing key                                                                   |
| GET `/receipt/{uuid}/image`                       | 1200×630 downloadable PNG, historical disclaimer                                                          |
| POST `/receipt/{uuid}/image`                      | Self-contained signed demo JSON → PNG; verifies integrity, requires demo mode, never writes live evidence |
| GET/POST `/api/v1/watchlist`                      | Owner records / insert WatchInput                                                                         |
| PATCH/DELETE `/api/v1/watchlist/{uuid}`           | Owner update / delete                                                                                     |
| GET/POST `/api/v1/alerts`                         | Owner rules / insert AlertInput                                                                           |
| PATCH/DELETE `/api/v1/alerts/{uuid}`              | Owner update / delete                                                                                     |
| GET/POST `/api/v1/profile`                        | Owner profile / email preference upsert                                                                   |
| GET `/api/v1/history`                             | Most recent 100 owner scans                                                                               |
| GET `/api/v1/events`                              | Most recent 100 owner monitoring notifications                                                            |
| GET `/api/v1/analytics/reliability`               | Aggregated live samples / empty insufficient-history state                                                |
| POST `/api/v1/monitor`                            | Bearer MONITOR_SECRET; lease and process ≤3 jobs                                                          |

WatchInput: `mint`, `name` (≤100), `symbol` (≤24), optional nullable `pool`, positive decimal `position` (USD, default 1000), `mode=live`. Demo persistence is rejected. PATCH accepts partial WatchInput.

AlertInput: `mint`, `kind` (`gap_above`, `liquidity_below`, `quote_unavailable`, `provider_deviation`, `stale`, `liquidity_drop`, `gap_increase`), numeric nonnegative `threshold`, optional `enabled` (true), `position` (1000), `cooldown_minutes` (15–10080, default 60), `email` (false). PATCH accepts partial fields. Same-user rules for one mint currently share the oldest enabled rule's position.

Requests over 12 KB are rejected. Mutations check origin when present; private requests use Supabase session cookies and server `getUser()`, then RLS. Expensive live analysis: 15/IP/minute; receipt issuance: 5/IP/minute with auth; user writes: 30/user/minute. Deployed shared limits use Supabase atomics and fail closed if unavailable; single-process fallback requires explicit production opt-in. Additional infrastructure-level limits should protect public demo endpoints before high-traffic launch.

Analysis includes mode, token, provider results/errors, selected pool, reference snapshot, comparison, quote, computed values, diagnostic reasons, capture time and limitations. Quote has expected output, minimum parameter, router/labels, impact, tolerance, fee fields, collection and display-expiry times. No transaction is exposed.

Provider schema references: [DexScreener](https://docs.dexscreener.com/api/reference), [GeckoTerminal](https://api.geckoterminal.com/docs/index.html), [Jupiter Swap V2](https://developers.jup.ag/docs/api-reference/swap/order). Official documentation was consulted during implementation. Public API behavior can change; run optional smoke tests when updating adapters.
