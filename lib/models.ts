export type Mode = "live" | "demo";
export type Source = "dexscreener" | "geckoterminal";
export type Scenario =
  | "poor"
  | "healthy"
  | "mismatch"
  | "no-route"
  | "stale"
  | "collapse"
  | "increasing";
export interface Token {
  mint: string;
  name: string;
  symbol: string;
  decimals: number | null;
  program: string | null;
  extensions: string[];
}
export interface Snapshot {
  source: Source;
  pool: string;
  mint: string;
  quoteMint: string;
  dex: string;
  price: string | null;
  liquidity: string | null;
  volume24h: string | null;
  marketCap: string | null;
  fdv: string | null;
  change24h: string | null;
  buys: number | null;
  sells: number | null;
  observedAt: string | null;
  retrievedAt: string;
  poolCreatedAt: string | null;
  sourceUrl: string;
}
export interface ProviderResult {
  source: Source;
  status: "LIVE" | "PARTIAL" | "UNAVAILABLE" | "DEMO";
  snapshots: Snapshot[];
  token: Token | null;
  error: string | null;
  latencyMs: number;
}
export interface Comparison {
  comparable: boolean;
  deviation: string | null;
  reason: string;
  left: Snapshot | null;
  right: Snapshot | null;
}
export interface Quote {
  status: "AVAILABLE" | "UNAVAILABLE" | "RATE_LIMITED";
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string | null;
  minimumOutput: string | null;
  router: string | null;
  routes: string[];
  priceImpact: string | null;
  slippageBps: number | null;
  feeBps: number | null;
  feeMint: string | null;
  signatureFeeLamports: string | null;
  priorityFeeLamports: string | null;
  rentFeeLamports: string | null;
  collectedAt: string;
  expiresAt: string;
  error: string | null;
  requestId: string | null;
  providerMetadata: {
    platformFee: {
      amount: string | null;
      feeBps: number | null;
      feeMint: string | null;
    } | null;
    expireAt: string | null;
    lastValidBlockHeight: string | null;
    errorCode: number | null;
  };
}
export interface ExitValues {
  quantity: string;
  referencePrice: string | null;
  displayedValue: string | null;
  quotedUsdc: string | null;
  usdcUsd: string;
  conversionBasis: string;
  exitValue: string | null;
  dollarGap: string | null;
  gapPercent: string | null;
}
export interface Diagnostic {
  status:
    | "NORMAL"
    | "WATCH"
    | "HIGH DISCREPANCY"
    | "QUOTE UNAVAILABLE"
    | "INSUFFICIENT DATA"
    | "DATA STALE";
  reasons: string[];
}
export interface Analysis {
  mode: Mode;
  scenario?: Scenario;
  token: Token;
  providers: ProviderResult[];
  pool: string | null;
  reference: Snapshot | null;
  comparison: Comparison;
  quote: Quote;
  values: ExitValues;
  diagnostic: Diagnostic;
  capturedAt: string;
  limitations: string[];
}
export interface ReceiptContent {
  id: string;
  mode: Mode;
  issuedAt: string;
  methodology: string;
  analysis: Analysis;
}
export interface Receipt {
  content: ReceiptContent;
  hash: string;
  signature: string;
  keyId: string;
  publicKey: string;
  algorithm: "Ed25519";
}
