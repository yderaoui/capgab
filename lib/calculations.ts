import Decimal from "decimal.js";
import type {
  Comparison,
  Diagnostic,
  ExitValues,
  Quote,
  Snapshot,
} from "./models";
Decimal.set({ precision: 100, toExpNeg: -100, toExpPos: 100 });
export { Decimal };
export const RULES = {
  watchGap: 5,
  highGap: 15,
  providerWatch: 2,
  providerHigh: 10,
  quoteMaxAgeMs: 15_000,
  snapshotMaxAgeMs: 120_000,
  alignmentMs: 30_000,
  methodology: "1.0.0",
} as const;
export function positive(value: string | null | undefined): boolean {
  try {
    return (
      value != null && new Decimal(value).isFinite() && new Decimal(value).gt(0)
    );
  } catch {
    return false;
  }
}
export function calculateExit(
  quantity: string,
  price: string | null,
  output: string | null,
  usdcUsd = "1",
  basis = "USDC approximated at $1; depeg risk is not modeled.",
): ExitValues {
  const result: ExitValues = {
    quantity,
    referencePrice: price,
    displayedValue: null,
    quotedUsdc: output,
    usdcUsd,
    conversionBasis: basis,
    exitValue: null,
    dollarGap: null,
    gapPercent: null,
  };
  if (!positive(quantity) || !positive(price)) return result;
  const display = new Decimal(quantity).mul(price!);
  result.displayedValue = display.toFixed();
  try {
    if (
      output == null ||
      !new Decimal(output).isFinite() ||
      new Decimal(output).lt(0) ||
      !positive(usdcUsd)
    )
      return result;
  } catch {
    return result;
  }
  const exit = new Decimal(output).mul(usdcUsd);
  const gap = display.sub(exit);
  return {
    ...result,
    exitValue: exit.toFixed(),
    dollarGap: gap.toFixed(),
    gapPercent: gap.div(display).mul(100).toFixed(),
  };
}
export function comparePools(
  left: Snapshot | null,
  right: Snapshot | null,
): Comparison {
  const fail = (reason: string): Comparison => ({
    comparable: false,
    deviation: null,
    reason,
    left,
    right,
  });
  if (!left || !right)
    return fail("NOT DIRECTLY COMPARABLE: a matching source is missing.");
  if (
    left.pool !== right.pool ||
    left.mint !== right.mint ||
    left.quoteMint !== right.quoteMint
  )
    return fail(
      "NOT DIRECTLY COMPARABLE: pool, token, or quote asset differs.",
    );
  if (!positive(left.price) || !positive(right.price))
    return fail("NOT DIRECTLY COMPARABLE: USD price is missing.");
  if (!left.observedAt || !right.observedAt)
    return fail(
      "NOT DIRECTLY COMPARABLE: providers do not expose source observation timestamps. Retrieval times are not market observation times.",
    );
  if (
    !Number.isFinite(Date.parse(left.observedAt)) ||
    !Number.isFinite(Date.parse(right.observedAt))
  )
    return fail("NOT DIRECTLY COMPARABLE: source timestamp is invalid.");
  if (
    Math.abs(Date.parse(left.observedAt) - Date.parse(right.observedAt)) >
    RULES.alignmentMs
  )
    return fail(
      "NOT DIRECTLY COMPARABLE: observations exceed the 30-second alignment window.",
    );
  const deviation = new Decimal(left.price!)
    .sub(right.price!)
    .abs()
    .div(new Decimal(left.price!).add(right.price!).div(2))
    .mul(100)
    .toFixed();
  return {
    comparable: true,
    deviation,
    reason:
      "Same pool, same asset pair, USD units, source observations within 30 seconds. Agreement is not proof of accuracy.",
    left,
    right,
  };
}
export function diagnose(
  values: ExitValues,
  quote: Quote,
  comparison: Comparison,
  reference: Snapshot | null,
  now = Date.now(),
): Diagnostic {
  if (
    now - Date.parse(quote.collectedAt) > RULES.quoteMaxAgeMs ||
    (reference &&
      now - Date.parse(reference.observedAt ?? reference.retrievedAt) >
        RULES.snapshotMaxAgeMs)
  )
    return {
      status: "DATA STALE",
      reasons: [
        "Quote or market retrieval is older than the methodology freshness threshold. Refresh before assessing an exit.",
      ],
    };
  if (!values.displayedValue)
    return {
      status: "INSUFFICIENT DATA",
      reasons: [
        "A positive reference price and an exact input quantity are required.",
      ],
    };
  if (quote.status !== "AVAILABLE")
    return {
      status: "QUOTE UNAVAILABLE",
      reasons: [quote.error ?? "No USDC sale quote is available."],
    };
  const gap = Number(values.gapPercent);
  const dev = Number(comparison.deviation);
  if (values.gapPercent == null)
    return {
      status: "INSUFFICIENT DATA",
      reasons: ["Expected output or its USD conversion is unavailable."],
    };
  const explanation = `Quoted exit differs from displayed value by ${new Decimal(values.gapPercent).toFixed(2)}%. This is an estimate, not a prediction.`;
  if (
    gap >= RULES.highGap ||
    (comparison.comparable && dev >= RULES.providerHigh)
  )
    return { status: "HIGH DISCREPANCY", reasons: [explanation] };
  if (
    gap >= RULES.watchGap ||
    !comparison.comparable ||
    (comparison.comparable && dev >= RULES.providerWatch)
  )
    return {
      status: "WATCH",
      reasons: [
        explanation,
        ...(!comparison.comparable ? [comparison.reason] : []),
      ],
    };
  return {
    status: "NORMAL",
    reasons: [
      explanation,
      "Normal reflects the configured thresholds only; it does not establish safety.",
    ],
  };
}
