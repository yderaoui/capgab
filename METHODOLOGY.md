# Market reality methodology 1.0.0

Let `A` be token quantity, `P` USD/token reference, `Q` expected USDC from the exact-size quote, `U` USD/USDC conversion.

```
displayed = A × P
estimated exit = Q × U
dollar gap = displayed − estimated exit
gap percentage = 100 × dollar gap / displayed
```

All inputs must be finite and valid. Quantity, price and conversion must be positive; output may be zero only when explicitly supplied. Missing values remain null, never invented zero. Favorable negative gaps remain negative. Atomic quantities use decimal-string splitting and BigInt, never floating-point multiplication. Inputs greater than Solana u64 are rejected. USD-sized positions round down to mint precision. Display formatting rounds independently of calculation.

Market price is a pool observation. Market cap generally uses circulating supply; FDV generally uses fully diluted supply. Pool liquidity represents reported reserves, not executable depth for an arbitrary position. These terms must not be substituted for one another.

A direct provider price comparison requires same chain, pool, input token, counterpart asset, USD units, and source observations within 30 seconds. Symmetric price deviation is `100 × |P1−P2| / ((P1+P2)/2)`. Retrieval time is not observation time. The current public pool APIs generally omit observation time: we show snapshots but suppress discrepancy percentages. Valuation, volume and reserve methodology mismatches are never automatically scored as errors.

Jupiter Swap V2 `/order` receives the actual atomic quantity, official USDC mint, optional server API key, and no taker, referral or signer. Returned transactions are discarded. Expected proceeds are estimates; route availability does not prove a sale would succeed. `priceImpact` is a provider indicator in percentage points and is distinct from slippage tolerance and the CAPGAP gap. A minimum output is a transaction parameter, not guaranteed proceeds.

USDC conversion uses a recent available USD observation, otherwise a disclosed $1 approximation. Reported fee rates and network-cost fields are displayed separately; missing fees are unknown. The platform does not subtract unverified costs or independently model transfer hooks, transfer fees, account restrictions or realized execution. Output is not advertised as net realized proceeds.

Rules in `lib/calculations.ts`: stale quote collection over 15 seconds or market retrieval/observation over 120 seconds; insufficient required inputs; unavailable quote; high discrepancy for exit gap ≥15% or comparable provider deviation ≥10%; watch for gap ≥5%, deviation ≥2%, or inadequate comparison evidence; otherwise normal. Priority follows that order. “Normal” is a diagnostic of supplied inputs, not safety, a fraud probability or a future-price prediction. A freshness threshold is CAPGAP policy, not a quote-validity guarantee.

Receipts preserve historical inputs with collection timestamps. Canonicalization sorts object keys recursively using JavaScript lexical ordering, preserves arrays and JSON primitive encodings, and encodes UTF-8. SHA-256 hashes canonical content; Ed25519 signs the 32 digest bytes. Public key identity must be checked against the server registry or an independently trusted copy. Self-contained signature validity alone is not identity trust. A signature says nothing about the truthfulness of upstream market data.

Live historical analytics comes only from persisted observations. Retrieval success, coverage, sample count, median latency, unknown source timestamps, and aligned price deviation must be read with collection period and selection bias. Two services agreeing is not independent accuracy. Personal aligned charts require equal token, pool, position quantity and conversion context; this implementation does not fabricate them.

Demo scenarios are fictional; all sample prices, liquidity and quote curves are prominently labeled. Liquidity-collapse and increasing-gap demos illustrate current size-sensitive conditions, not a manufactured historical decline.
