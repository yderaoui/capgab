import type { ProviderResult, Scenario, Snapshot } from "./models";
import { Decimal } from "./calculations";
import { SOL_MINT, USDC_MINT, fromAtomic } from "./solana";
import { unavailableQuote } from "./providers/jupiter";
export const DEMO_MINT = "11111111111111111111111111111112";
export const SCENARIOS: { id: Scenario; name: string; description: string }[] =
  [
    {
      id: "poor",
      name: "Poor exit liquidity",
      description: "A $2,000 position has a simulated $1,640 exit.",
    },
    {
      id: "healthy",
      name: "Healthy liquidity",
      description: "Deeper reserves, smaller size-dependent gaps.",
    },
    {
      id: "mismatch",
      name: "Provider mismatch",
      description: "Aligned fictional observations disagree on one pool.",
    },
    {
      id: "no-route",
      name: "No USDC route",
      description: "A price exists, but no simulated sale route does.",
    },
    {
      id: "stale",
      name: "Stale observations",
      description: "Old quotes and observations trigger freshness warnings.",
    },
    {
      id: "collapse",
      name: "Liquidity collapse",
      description: "Thin current reserves; no fabricated historical series.",
    },
    {
      id: "increasing",
      name: "Size-sensitive exit",
      description: "Larger positions have a greater simulated exit gap.",
    },
  ];
export function demoMarket(scenario: Scenario): ProviderResult[] {
  const stale = scenario === "stale";
  const stamp = new Date(Date.now() - (stale ? 600_000 : 0)).toISOString();
  const liquidity =
    scenario === "healthy"
      ? "2400000"
      : scenario === "collapse"
        ? "3600"
        : "182200";
  const base: Snapshot = {
    source: "dexscreener",
    mint: DEMO_MINT,
    pool: SOL_MINT,
    quoteMint: USDC_MINT,
    dex: "Simulated pool",
    price: "0.002",
    liquidity,
    volume24h: "426800",
    marketCap: "2000000",
    fdv: "2400000",
    change24h: "12.4",
    buys: 1264,
    sells: 982,
    observedAt: stamp,
    retrievedAt: stamp,
    poolCreatedAt: null,
    sourceUrl: "https://docs.dexscreener.com/api/reference",
  };
  return (["dexscreener", "geckoterminal"] as const).map((source) => ({
    source,
    status: "DEMO",
    token: {
      mint: DEMO_MINT,
      name: "Example token",
      symbol: "EXAMPLE",
      decimals: 6,
      program: "SIMULATED",
      extensions: [],
    },
    snapshots: [
      {
        ...base,
        source,
        price:
          source === "geckoterminal"
            ? scenario === "mismatch"
              ? "0.0026"
              : "0.002004"
            : base.price,
        sourceUrl:
          source === "geckoterminal"
            ? "https://api.geckoterminal.com/docs/index.html"
            : base.sourceUrl,
      },
      {
        ...base,
        source,
        pool: USDC_MINT,
        quoteMint: SOL_MINT,
        price: "0.00198",
        liquidity: new Decimal(liquidity).div(5).toFixed(),
        dex: "Alternative simulated pool",
      },
    ],
    error: null,
    latencyMs: 0,
  }));
}
export function demoQuote(amount: string, scenario: Scenario) {
  const q = unavailableQuote(
    DEMO_MINT,
    amount,
    "Simulated scenario has no USDC route.",
  );
  if (scenario === "no-route") return q;
  const display = new Decimal(fromAtomic(amount, 6)).mul("0.002");
  // Deterministic illustrative AMM-shaped curve; never used for live requests.
  const reserve =
    scenario === "healthy"
      ? "250000"
      : scenario === "collapse"
        ? "500"
        : scenario === "increasing"
          ? "4000"
          : new Decimal(2000).mul("0.82").div("0.18").toFixed();
  const proceeds = display.div(new Decimal(1).add(display.div(reserve)));
  const now = new Date(Date.now() - (scenario === "stale" ? 600_000 : 0));
  return {
    ...q,
    status: "AVAILABLE" as const,
    error: null,
    outAmount: proceeds.mul(1e6).floor().toFixed(0),
    router: "Simulated AMM",
    routes: ["Fictional USDC pool"],
    priceImpact: new Decimal(1).sub(proceeds.div(display)).mul(100).toFixed(2),
    slippageBps: 50,
    feeBps: null,
    collectedAt: now.toISOString(),
    expiresAt: new Date(+now + 15_000).toISOString(),
  };
}
