import { createHash } from "node:crypto";
import type { Analysis } from "./models";
export interface AlertRule {
  id: string;
  kind: string;
  threshold: number;
  cooldown_minutes: number;
}
export function alertTriggered(
  rule: AlertRule,
  a: Analysis,
  previous?: Analysis,
): boolean {
  switch (rule.kind) {
    case "gap_above":
      return (
        a.values.gapPercent != null &&
        Number(a.values.gapPercent) > rule.threshold
      );
    case "liquidity_below":
      return (
        a.reference?.liquidity != null &&
        Number(a.reference.liquidity) < rule.threshold
      );
    case "quote_unavailable":
      return a.quote.status !== "AVAILABLE";
    case "provider_deviation":
      return (
        a.comparison.comparable &&
        a.comparison.deviation != null &&
        Number(a.comparison.deviation) > rule.threshold
      );
    case "stale":
      return a.diagnostic.status === "DATA STALE";
    case "gap_increase":
      return (
        previous?.values.gapPercent != null &&
        a.values.gapPercent != null &&
        Number(a.values.gapPercent) - Number(previous.values.gapPercent) >
          rule.threshold
      );
    case "liquidity_drop":
      return (
        previous?.reference?.liquidity != null &&
        a.reference?.liquidity != null &&
        Number(previous.reference.liquidity) > 0 &&
        (1 -
          Number(a.reference.liquidity) /
            Number(previous.reference.liquidity)) *
          100 >
          rule.threshold
      );
    default:
      return false;
  }
}
export function dedupeKey(
  ruleId: string,
  now: number,
  cooldownMinutes: number,
): string {
  return createHash("sha256")
    .update(`${ruleId}:${Math.floor(now / (cooldownMinutes * 60000))}`)
    .digest("hex");
}
