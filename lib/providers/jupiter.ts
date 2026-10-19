import { z } from "zod";
import type { Quote } from "../models";
import { USDC_MINT } from "../solana";
import { providerJson, errorText, ProviderError, retrievalTime } from "./http";
const atom = z.string().regex(/^\d+$/);
const nullableAtom = z
  .union([atom, z.number().int().nonnegative()])
  .nullish()
  .transform((v) => (v == null ? null : String(v)));
const schema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: atom,
  outAmount: atom,
  router: z.string().optional(),
  routePlan: z
    .array(
      z.object({
        swapInfo: z.object({ label: z.string().optional() }).optional(),
      }),
    )
    .optional(),
  priceImpact: z.union([z.string(), z.number()]).nullish(),
  slippageBps: z.number().nullish(),
  feeBps: z.number().nullish(),
  feeMint: z.string().nullish(),
  signatureFeeLamports: nullableAtom,
  prioritizationFeeLamports: nullableAtom,
  rentFeeLamports: nullableAtom,
  otherAmountThreshold: atom.nullish(),
  requestId: z.string().optional(),
  errorMessage: z.string().optional(),
  platformFee: z
    .object({
      amount: atom.nullish(),
      feeBps: z.number().nullish(),
      feeMint: z.string().nullish(),
    })
    .nullish(),
  expireAt: z.string().nullish(),
  lastValidBlockHeight: z.union([z.string(), z.number().int()]).nullish(),
  errorCode: z.number().nullish(),
});
export function unavailableQuote(
  mint: string,
  amount: string,
  error: string,
  status: Quote["status"] = "UNAVAILABLE",
): Quote {
  const now = new Date();
  return {
    status,
    inputMint: mint,
    outputMint: USDC_MINT,
    inAmount: amount,
    outAmount: null,
    minimumOutput: null,
    router: null,
    routes: [],
    priceImpact: null,
    slippageBps: null,
    feeBps: null,
    feeMint: null,
    signatureFeeLamports: null,
    priorityFeeLamports: null,
    rentFeeLamports: null,
    collectedAt: now.toISOString(),
    expiresAt: new Date(+now + 15_000).toISOString(),
    error,
    requestId: null,
    providerMetadata: {
      platformFee: null,
      expireAt: null,
      lastValidBlockHeight: null,
      errorCode: null,
    },
  };
}
export function normalizeQuote(
  raw: unknown,
  mint: string,
  amount: string,
): Quote {
  const upstreamError = z.object({ error: z.string() }).safeParse(raw);
  if (upstreamError.success)
    throw new Error(`Jupiter: ${upstreamError.data.error.slice(0, 240)}`);
  const q = schema.parse(raw);
  if (
    q.inputMint !== mint ||
    q.outputMint !== USDC_MINT ||
    q.inAmount !== amount ||
    BigInt(q.outAmount) <= 0n
  )
    throw new Error("Quote asset, amount, or output validation failed.");
  return {
    ...unavailableQuote(mint, amount, ""),
    status: "AVAILABLE",
    error: q.errorMessage ?? null,
    outAmount: q.outAmount,
    minimumOutput: q.otherAmountThreshold ?? null,
    router: q.router ?? null,
    routes:
      q.routePlan?.flatMap((r) =>
        r.swapInfo?.label ? [r.swapInfo.label] : [],
      ) ?? [],
    priceImpact: q.priceImpact == null ? null : String(q.priceImpact),
    slippageBps: q.slippageBps ?? null,
    feeBps: q.feeBps ?? null,
    feeMint: q.feeMint ?? null,
    signatureFeeLamports: q.signatureFeeLamports,
    priorityFeeLamports: q.prioritizationFeeLamports,
    rentFeeLamports: q.rentFeeLamports,
    requestId: q.requestId ?? null,
    providerMetadata: {
      platformFee: q.platformFee
        ? {
            amount: q.platformFee.amount ?? null,
            feeBps: q.platformFee.feeBps ?? null,
            feeMint: q.platformFee.feeMint ?? null,
          }
        : null,
      expireAt: q.expireAt ?? null,
      lastValidBlockHeight:
        q.lastValidBlockHeight == null ? null : String(q.lastValidBlockHeight),
      errorCode: q.errorCode ?? null,
    },
  };
}
let queue = Promise.resolve();
let nextSlot = 0;
let pendingQuotes = 0;
export async function getQuote(mint: string, amount: string): Promise<Quote> {
  if (pendingQuotes >= 8)
    return unavailableQuote(
      mint,
      amount,
      "Quote queue is full. Pause requests and retry shortly.",
      "RATE_LIMITED",
    );
  pendingQuotes++;
  // Serialize provider calls across this process: keyless Jupiter permits 0.5 RPS.
  const task = queue.then(async () => {
    const wait = Math.max(0, nextSlot - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    nextSlot = Date.now() + (process.env.JUPITER_API_KEY ? 1100 : 2100);
    try {
      const url = `https://api.jup.ag/swap/v2/order?inputMint=${mint}&outputMint=${USDC_MINT}&amount=${amount}`;
      const raw = await providerJson(
        url,
        5_000,
        process.env.JUPITER_API_KEY
          ? { "x-api-key": process.env.JUPITER_API_KEY }
          : {},
      );
      const result = normalizeQuote(raw, mint, amount);
      const collectedAt = retrievalTime(url);
      return {
        ...result,
        collectedAt,
        expiresAt: new Date(Date.parse(collectedAt) + 15_000).toISOString(),
      };
    } catch (e) {
      return unavailableQuote(
        mint,
        amount,
        errorText(e),
        e instanceof ProviderError && e.status === 429
          ? "RATE_LIMITED"
          : "UNAVAILABLE",
      );
    }
  });
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  try {
    return await task;
  } finally {
    pendingQuotes--;
  }
}
