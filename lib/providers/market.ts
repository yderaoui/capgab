import { z } from "zod";
import type { ProviderResult, Snapshot } from "../models";
import { positive } from "../calculations";
import { providerJson, errorText, retrievalTime } from "./http";
const numeric = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? null : String(v)))
  .refine((v) => v === null || /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v));
const dexPair = z.object({
  chainId: z.string(),
  pairAddress: z.string(),
  dexId: z.string(),
  baseToken: z.object({
    address: z.string(),
    name: z.string(),
    symbol: z.string(),
  }),
  quoteToken: z.object({ address: z.string() }),
  priceUsd: numeric,
  liquidity: z.object({ usd: numeric }).nullish(),
  volume: z.object({ h24: numeric }).nullish(),
  marketCap: numeric,
  fdv: numeric,
  pairCreatedAt: z.number().nullish(),
  priceChange: z.object({ h24: numeric }).nullish(),
  txns: z
    .object({ h24: z.object({ buys: z.number(), sells: z.number() }) })
    .nullish(),
});
export function normalizeDex(
  raw: unknown,
  mint: string,
  retrievedAt: string,
): ProviderResult {
  const pairs = z
    .array(dexPair)
    .parse(raw)
    .filter((p) => p.chainId === "solana" && p.baseToken.address === mint);
  return {
    source: "dexscreener",
    status: pairs.length ? "LIVE" : "PARTIAL",
    error: pairs.length
      ? null
      : "No supported base-token pools were returned. Quote-side pricing is not inferred.",
    latencyMs: 0,
    token: pairs[0]
      ? {
          mint,
          name: pairs[0].baseToken.name,
          symbol: pairs[0].baseToken.symbol,
          decimals: null,
          program: null,
          extensions: [],
        }
      : null,
    snapshots: pairs.map((p) => ({
      source: "dexscreener",
      pool: p.pairAddress,
      mint,
      quoteMint: p.quoteToken.address,
      dex: p.dexId,
      price: p.priceUsd ?? null,
      liquidity: p.liquidity?.usd ?? null,
      volume24h: p.volume?.h24 ?? null,
      marketCap: p.marketCap ?? null,
      fdv: p.fdv ?? null,
      change24h: p.priceChange?.h24 ?? null,
      buys: p.txns?.h24.buys ?? null,
      sells: p.txns?.h24.sells ?? null,
      observedAt: null,
      retrievedAt,
      poolCreatedAt: p.pairCreatedAt
        ? new Date(p.pairCreatedAt).toISOString()
        : null,
      sourceUrl: `https://dexscreener.com/solana/${encodeURIComponent(p.pairAddress)}`,
    })),
  };
}
const relation = z.object({ data: z.object({ id: z.string() }) });
const geckoPool = z.object({
  attributes: z.object({
    address: z.string(),
    base_token_price_usd: numeric,
    quote_token_price_usd: numeric,
    reserve_in_usd: numeric,
    volume_usd: z.object({ h24: numeric }).nullish(),
    market_cap_usd: numeric,
    fdv_usd: numeric,
    pool_created_at: z.string().nullish(),
    price_change_percentage: z.object({ h24: numeric }).nullish(),
    transactions: z
      .object({ h24: z.object({ buys: z.number(), sells: z.number() }) })
      .nullish(),
  }),
  relationships: z.object({
    base_token: relation,
    quote_token: relation,
    dex: relation,
  }),
});
const included = z.object({
  id: z.string(),
  type: z.string(),
  attributes: z.object({
    address: z.string().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number().int().min(0).max(255).optional(),
  }),
});
export function normalizeGecko(
  raw: unknown,
  mint: string,
  retrievedAt: string,
): ProviderResult {
  const parsed = z
    .object({
      data: z.array(geckoPool),
      included: z.array(included).optional(),
    })
    .parse(raw);
  const token = parsed.included?.find(
    (t) => t.type === "token" && t.attributes.address === mint,
  )?.attributes;
  const snapshots: Snapshot[] = parsed.data.flatMap((p) => {
    const a = p.attributes;
    const base = p.relationships.base_token.data.id.replace(/^solana_/, "");
    const quote = p.relationships.quote_token.data.id.replace(/^solana_/, "");
    const isBase = base === mint;
    if (!isBase && quote !== mint) return [];
    return [
      {
        source: "geckoterminal",
        pool: a.address,
        mint,
        quoteMint: isBase ? quote : base,
        dex: p.relationships.dex.data.id,
        price:
          (isBase ? a.base_token_price_usd : a.quote_token_price_usd) ?? null,
        liquidity: a.reserve_in_usd ?? null,
        volume24h: a.volume_usd?.h24 ?? null,
        marketCap: isBase ? (a.market_cap_usd ?? null) : null,
        fdv: isBase ? (a.fdv_usd ?? null) : null,
        change24h: isBase ? (a.price_change_percentage?.h24 ?? null) : null,
        buys: a.transactions?.h24.buys ?? null,
        sells: a.transactions?.h24.sells ?? null,
        observedAt: null,
        retrievedAt,
        poolCreatedAt: a.pool_created_at ?? null,
        sourceUrl: `https://www.geckoterminal.com/solana/pools/${encodeURIComponent(a.address)}`,
      },
    ];
  });
  return {
    source: "geckoterminal",
    status: snapshots.length ? "LIVE" : "PARTIAL",
    snapshots,
    token: token
      ? {
          mint,
          name: token.name ?? "Unknown token",
          symbol: token.symbol ?? "TOKEN",
          decimals: token.decimals ?? null,
          program: null,
          extensions: [],
        }
      : null,
    error: snapshots.length ? null : "No pools found.",
    latencyMs: 0,
  };
}
export async function getMarket(
  source: "dexscreener" | "geckoterminal",
  mint: string,
): Promise<ProviderResult> {
  const start = Date.now();
  const url =
    source === "dexscreener"
      ? `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`
      : `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?include=base_token,quote_token,dex`;
  try {
    const raw = await providerJson(url, 30_000);
    const time = retrievalTime(url);
    const result =
      source === "dexscreener"
        ? normalizeDex(raw, mint, time)
        : normalizeGecko(raw, mint, time);
    return { ...result, latencyMs: Date.now() - start };
  } catch (e) {
    return {
      source,
      status: "UNAVAILABLE",
      snapshots: [],
      token: null,
      error: errorText(e),
      latencyMs: Date.now() - start,
    };
  }
}
export function selectReference(
  providers: ProviderResult[],
  pool?: string,
): Snapshot | null {
  const all = providers
    .flatMap((p) => p.snapshots)
    .filter((s) => positive(s.price));
  if (pool) return all.find((s) => s.pool === pool) ?? null;
  return (
    all.sort(
      (a, b) => Number(b.liquidity ?? 0) - Number(a.liquidity ?? 0),
    )[0] ?? null
  );
}
