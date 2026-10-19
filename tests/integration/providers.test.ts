import { describe, it, expect, vi } from "vitest";
import {
  normalizeDex,
  normalizeGecko,
  getMarket,
} from "@/lib/providers/market";
import { normalizeQuote, getQuote } from "@/lib/providers/jupiter";
import { SOL_MINT, USDC_MINT } from "@/lib/solana";
const time = "2026-10-19T10:00:00.000Z";
const dex = [
  {
    chainId: "solana",
    pairAddress: SOL_MINT,
    dexId: "raydium",
    baseToken: { address: SOL_MINT, name: "Wrapped SOL", symbol: "SOL" },
    quoteToken: { address: USDC_MINT },
    priceUsd: "180",
    liquidity: { usd: 123456 },
    volume: { h24: 1234 },
    marketCap: 1000000,
    fdv: 1200000,
    pairCreatedAt: 1000000000000,
  },
];
const gecko = {
  data: [
    {
      attributes: {
        address: SOL_MINT,
        base_token_price_usd: "180.2",
        quote_token_price_usd: "1.0001",
        reserve_in_usd: "123456",
        market_cap_usd: null,
        fdv_usd: "1200000",
        volume_usd: { h24: "1234" },
      },
      relationships: {
        base_token: { data: { id: `solana_${SOL_MINT}` } },
        quote_token: { data: { id: `solana_${USDC_MINT}` } },
        dex: { data: { id: "raydium" } },
      },
    },
  ],
  included: [
    {
      id: `solana_${SOL_MINT}`,
      type: "token",
      attributes: {
        address: SOL_MINT,
        name: "Wrapped SOL",
        symbol: "SOL",
        decimals: 9,
      },
    },
  ],
};
describe("provider normalization", () => {
  it("keeps market cap distinct from FDV and source time unknown", () => {
    const a = normalizeDex(dex, SOL_MINT, time);
    expect(a.snapshots[0].price).toBe("180");
    expect(a.snapshots[0].marketCap).not.toBe(a.snapshots[0].fdv);
    expect(a.snapshots[0].observedAt).toBeNull();
    expect(a.snapshots[0].retrievedAt).toBe(time);
  });
  it("extracts Gecko mint precision and quote-side price without base valuation contamination", () => {
    const a = normalizeGecko(gecko, SOL_MINT, time);
    expect(a.token?.decimals).toBe(9);
    expect(a.snapshots[0].marketCap).toBeNull();
    const b = normalizeGecko(gecko, USDC_MINT, time);
    expect(b.snapshots[0].price).toBe("1.0001");
    expect(b.snapshots[0].fdv).toBeNull();
  });
  it("rejects invalid provider structures", () => {
    expect(() => normalizeDex({ fake: [] }, SOL_MINT, time)).toThrow();
    expect(() =>
      normalizeGecko(
        { data: [{ attributes: { price: "fake" } }] },
        SOL_MINT,
        time,
      ),
    ).toThrow();
  });
  it("mocks the actual Dex HTTP adapter and preserves cached retrieval times", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(dex), { status: 200 }));
    const a = await getMarket("dexscreener", SOL_MINT);
    expect(a.status).toBe("LIVE");
    const b = await getMarket("dexscreener", SOL_MINT);
    expect(b.snapshots[0].retrievedAt).toBe(a.snapshots[0].retrievedAt);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("mocks Gecko HTTP adapter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(gecko), { status: 200 }),
    );
    const a = await getMarket("geckoterminal", SOL_MINT);
    expect(a.token?.symbol).toBe("SOL");
    expect(a.token?.decimals).toBe(9);
  });
  it("surfaces 429 rather than fabricating a quote", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 429, headers: { "retry-after": "60" } }),
    );
    const q = await getQuote(SOL_MINT, "12340000");
    expect(q.status).toBe("RATE_LIMITED");
    expect(q.outAmount).toBeNull();
  });
});
describe("Jupiter exact quote contract", () => {
  const q = {
    inputMint: SOL_MINT,
    outputMint: USDC_MINT,
    inAmount: "1000000000",
    outAmount: "180000000",
    priceImpact: -0.1,
    router: "metis",
    feeBps: 2,
    feeMint: USDC_MINT,
    routePlan: [{ swapInfo: { label: "Raydium" } }],
    signatureFeeLamports: 5000,
    transaction: "never returned to client",
  };
  it("retains quote metadata but discards transaction payload", () => {
    const result = normalizeQuote(q, SOL_MINT, "1000000000");
    expect(result.outAmount).toBe("180000000");
    expect(result.routes).toEqual(["Raydium"]);
    expect(result.priceImpact).toBe("-0.1");
    expect(result).not.toHaveProperty("transaction");
    expect(result.priorityFeeLamports).toBeNull();
    const partial = normalizeQuote(
      { ...q, platformFee: { feeBps: 2 } },
      SOL_MINT,
      "1000000000",
    );
    expect(partial.status).toBe("AVAILABLE");
    expect(partial.providerMetadata.platformFee?.amount).toBeNull();
  });
  it("rejects wrong amounts or output assets", () => {
    expect(() =>
      normalizeQuote({ ...q, outputMint: SOL_MINT }, SOL_MINT, "1000000000"),
    ).toThrow();
    expect(() => normalizeQuote(q, SOL_MINT, "2000000000")).toThrow();
    expect(() =>
      normalizeQuote({ ...q, outAmount: "0" }, SOL_MINT, "1000000000"),
    ).toThrow();
  });
});
