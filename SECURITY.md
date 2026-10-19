# Security model

- No wallets, seed phrases, private-key collection, signatures from users, swap execution, token deployment or hidden referrals.
- Zod validates public input and upstream payloads. Valid mints restrict outbound API paths; there is no user-controlled URL fetch. RPC URL is trusted server configuration.
- React escapes token metadata. Source URLs use fixed provider origins and encoded pool paths. Core UI uses no external images or arbitrary token HTML.
- Supabase Auth magic links use PKCE. Private routes validate the session with the auth server and use owner-scoped queries plus RLS. Service role is server-only. Production rate limits use atomic database buckets and fail closed; local memory fallback is explicit.
- Mutations reject foreign Origin headers. Supabase session-cookie behavior and HTTPS are required in deployment. Same-origin browser fetches use JSON. Missing Origin is allowed for server/API clients and does not bypass authentication.
- Provider calls have timeouts, bounded retries and 429 pauses. Output quotes are validated against requested mints/atomic amount. Monetary input is string-based, precision-safe, and u64-bounded.
- Signed receipts are server-collected. Hash/signature verification can run independently. Production signing keys are environment secrets; registry holds public keys only. Database triggers prohibit receipt/key editing. Supabase database administrators retain ultimate control: append-only is a logical application/database control, not a blockchain guarantee.
- Monitoring requires constant-time bearer comparison, leases jobs, deduplicates alerts, retains failures, and uses server-side email. Public clients cannot invoke monitoring SQL functions or write observations.
- Headers deny framing, MIME sniffing and unnecessary device permissions. A nonce-based CSP is not yet implemented; assess third-party/script policy before public launch.
- Logs contain generic error names/statuses, never auth tokens, private keys or full provider URLs with credentials. Avoid logging raw request bodies or environment dumps in infrastructure.

## Review and testing

Unit tests cover exact amounts, negative/missing gaps, signatures and deduplication. PostgreSQL integration tests execute migration/RLS/immutability/leases. Browser tests cover invalid input, demo scanning, sizes, comparisons, evidence exports, verification, tampering, local alerts and unauthenticated API isolation. Hosted auth, cron, email and multi-tenant behavior must be tested with a staging Supabase project.

## Remaining security work

Public demo endpoints have per-process limits; deployment-wide infrastructure quotas are still needed for crypto/image generation. Per-process provider queues do not coordinate global provider quotas. Add distributed throttling, transactionally committed alert events/outbox, a monitored key-rotation runbook, account deletion operations, signed dependency updates and an external security review. The receipt trigger allows owner detachment on account deletion while preserving all signed content.

Dependency audit results and environment verification are recorded in `docs/VALIDATION.md`. Do not automatically force downgrade framework dependencies to address transitive development-tool findings. Reassess reachable code and upstream fixes deliberately.

Before broad public launch, the deployment operator must publish a monitored vulnerability-reporting contact. Do not invent a contact address or send reports to an unconfigured destination.
