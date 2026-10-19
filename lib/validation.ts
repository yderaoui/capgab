import { z } from "zod";
import { mintSchema } from "./solana";
export const amountSchema = z
  .string()
  .max(90)
  .regex(
    /^\d{1,60}(\.\d{1,30})?$/,
    "Use a positive decimal amount without exponent notation.",
  )
  .refine((v) => /[1-9]/.test(v), "Amount must be positive.");
export const scanSchema = z
  .object({
    mint: mintSchema,
    mode: z.enum(["live", "demo"]).default("live"),
    scenario: z
      .enum([
        "poor",
        "healthy",
        "mismatch",
        "no-route",
        "stale",
        "collapse",
        "increasing",
      ])
      .default("poor"),
    amount: amountSchema.default("2000"),
    input: z.enum(["usd", "tokens"]).default("usd"),
    pool: mintSchema.optional(),
  })
  .strict();
export type ScanInput = z.infer<typeof scanSchema>;
export const watchSchema = z
  .object({
    mint: mintSchema,
    name: z.string().min(1).max(100),
    symbol: z.string().min(1).max(24),
    pool: mintSchema.nullable().optional(),
    position: amountSchema.default("1000"),
    mode: z.enum(["live", "demo"]).default("live"),
  })
  .strict();
export const alertSchema = z
  .object({
    mint: mintSchema,
    kind: z.enum([
      "gap_above",
      "liquidity_below",
      "quote_unavailable",
      "provider_deviation",
      "stale",
      "liquidity_drop",
      "gap_increase",
    ]),
    threshold: z.number().finite().min(0).max(1e15),
    enabled: z.boolean().default(true),
    cooldown_minutes: z.number().int().min(15).max(10080).default(60),
    position: amountSchema.default("1000"),
    email: z.boolean().default(false),
  })
  .strict();
