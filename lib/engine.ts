import type { Analysis, Token } from "./models";
import type { ScanInput } from "./validation";
import { demoMarket, demoQuote } from "./demo";
import { getMarket, selectReference } from "./providers/market";
import { getQuote, unavailableQuote } from "./providers/jupiter";
import {
  calculateExit,
  comparePools,
  Decimal,
  diagnose,
  positive,
} from "./calculations";
import { fromAtomic, toAtomic } from "./solana";
import { z } from "zod";
import { ApiError } from "./errors";
async function enrichMint(
  token: Token,
): Promise<{ token: Token; warning: string | null }> {
  if (!process.env.SOLANA_RPC_URL)
    return {
      token,
      warning:
        "RPC mint validation is not configured. Token decimals use provider metadata; Token-2022 extensions and transfer fees have not been inspected.",
    };
  try {
    const res = await fetch(process.env.SOLANA_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [
          token.mint,
          { encoding: "jsonParsed", commitment: "confirmed" },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    const raw = await res.json();
    const value = z
      .object({
        result: z.object({
          value: z.object({
            owner: z.string(),
            data: z.object({
              parsed: z.object({
                type: z.literal("mint"),
                info: z.object({
                  decimals: z.number().int().min(0).max(255),
                  extensions: z
                    .array(z.object({ extension: z.string() }))
                    .optional(),
                }),
              }),
            }),
          }),
        }),
      })
      .parse(raw).result.value;
    if (
      ![
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
      ].includes(value.owner)
    )
      throw new Error("Unsupported mint account owner.");
    return {
      token: {
        ...token,
        decimals: value.data.parsed.info.decimals,
        program: value.owner,
        extensions:
          value.data.parsed.info.extensions?.map((e) => e.extension) ?? [],
      },
      warning: null,
    };
  } catch {
    return {
      token: { ...token, decimals: null },
      warning:
        "RPC mint validation failed. Exact sell quotes are disabled because mint decimals could not be verified.",
    };
  }
}
export async function analyze(input: ScanInput): Promise<Analysis> {
  const providers =
    input.mode === "demo"
      ? demoMarket(input.scenario)
      : await Promise.all([
          getMarket("dexscreener", input.mint),
          getMarket("geckoterminal", input.mint),
        ]);
  const initial = providers.find((p) => p.token?.decimals != null)?.token ??
    providers.find((p) => p.token)?.token ?? {
      mint: input.mint,
      name: "Unresolved token",
      symbol: "UNKNOWN",
      decimals: null,
      program: null,
      extensions: [],
    };
  const enriched =
    input.mode === "demo"
      ? { token: initial, warning: null }
      : await enrichMint(initial);
  const token = enriched.token;
  const reference = selectReference(providers, input.pool);
  const left =
    providers[0].snapshots.find((s) => s.pool === reference?.pool) ?? null;
  const right =
    providers[1].snapshots.find((s) => s.pool === reference?.pool) ?? null;
  const comparison = comparePools(left, right);
  let quantity = input.amount;
  let amount = "0";
  if (input.input === "usd")
    quantity = positive(reference?.price)
      ? new Decimal(input.amount)
          .div(reference!.price!)
          .toFixed(token.decimals ?? 0, Decimal.ROUND_DOWN)
      : "0";
  if (token.decimals != null) {
    try {
      amount = toAtomic(quantity, token.decimals);
    } catch (e) {
      throw new ApiError(
        400,
        "INVALID_AMOUNT",
        e instanceof Error ? e.message : "Invalid token amount.",
      );
    }
  }
  if (BigInt(amount) > 18446744073709551615n)
    throw new ApiError(
      400,
      "AMOUNT_OUT_OF_RANGE",
      "Token amount exceeds Solana u64 limits. Choose a smaller position.",
    );
  const quote =
    BigInt(amount) === 0n
      ? unavailableQuote(
          token.mint,
          amount,
          token.decimals == null
            ? "Token decimals are unavailable. No atomic amount was guessed."
            : "A positive price and non-zero token amount are required.",
        )
      : input.mode === "demo"
        ? demoQuote(amount, input.scenario)
        : await getQuote(token.mint, amount);
  let usdcPrice = "1";
  let conversionBasis =
    "USDC approximated at $1; no observed USD conversion is available.";
  // USDC observations use the same public market adapter, cached independently.
  if (input.mode === "live" && quote.status === "AVAILABLE") {
    const { USDC_MINT } = await import("./solana");
    const conversion = await getMarket("dexscreener", USDC_MINT);
    const ref = selectReference([conversion]);
    if (ref?.price && Date.now() - Date.parse(ref.retrievedAt) < 120_000) {
      usdcPrice = ref.price;
      conversionBasis = `DexScreener USDC/USD pool ${ref.pool}; retrieved ${ref.retrievedAt}; source observation time unavailable.`;
    }
  }
  if (input.mode === "demo")
    conversionBasis = "SIMULATED: USDC is assumed to be $1.";
  const values = calculateExit(
    quantity,
    reference?.price ?? null,
    quote.outAmount ? fromAtomic(quote.outAmount, 6) : null,
    usdcPrice,
    conversionBasis,
  );
  const limitations = [
    "Quoted proceeds are estimates, not guaranteed execution. No transaction is built, signed, or submitted.",
    "Network fees and transfer-fee effects are unknown unless explicitly supplied; quoted proceeds are not net realized proceeds.",
    "Liquidity is a pool-level snapshot, not an amount guaranteed to be available to this position.",
    "Source observation timestamps may be unavailable. Retrieval freshness does not establish market-data freshness.",
    ...(enriched.warning ? [enriched.warning] : []),
    ...(token.extensions.length
      ? [
          `Mint extensions detected: ${token.extensions.join(", ")}. Their execution effects are not independently modeled.`,
        ]
      : []),
    ...(input.mode === "demo"
      ? [
          "DEMO / SIMULATED DATA. Fictional prices and an illustrative reserve curve; not a market quote.",
        ]
      : []),
  ];
  return {
    mode: input.mode,
    ...(input.mode === "demo" ? { scenario: input.scenario } : {}),
    token,
    providers,
    pool: reference?.pool ?? null,
    reference,
    comparison,
    quote,
    values,
    diagnostic: diagnose(values, quote, comparison, reference),
    capturedAt: new Date().toISOString(),
    limitations,
  };
}
