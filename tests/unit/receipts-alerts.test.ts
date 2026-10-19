import { describe, it, expect } from "vitest";
import {
  canonicalize,
  hashContent,
  issueReceipt,
  verifyReceipt,
} from "@/lib/receipts";
import { alertTriggered, dedupeKey } from "@/lib/alerts";
import { analyze } from "@/lib/engine";
import { DEMO_MINT } from "@/lib/demo";
import { scanSchema } from "@/lib/validation";
describe("receipt integrity", () => {
  it("canonicalizes deeply without changing array order", () => {
    expect(canonicalize({ b: { z: 1, a: 2 }, a: [2, 1] })).toBe(
      '{"a":[2,1],"b":{"a":2,"z":1}}',
    );
    expect(hashContent({ b: 2, a: 1 })).toBe(hashContent({ a: 1, b: 2 }));
    expect(hashContent([1, 2])).not.toBe(hashContent([2, 1]));
  });
  it("signs, independently verifies, and detects all content tampering", async () => {
    const a = await analyze(
      scanSchema.parse({ mint: DEMO_MINT, mode: "demo" }),
    );
    const r = issueReceipt(a);
    expect(verifyReceipt(r, r.publicKey)).toEqual({
      valid: true,
      hashValid: true,
      signatureValid: true,
      trusted: true,
    });
    expect(verifyReceipt(r).trusted).toBe(false);
    const modified = structuredClone(r);
    modified.content.analysis.values.exitValue = "2000";
    expect(verifyReceipt(modified).valid).toBe(false);
    modified.hash = hashContent(modified.content);
    expect(verifyReceipt(modified).signatureValid).toBe(false);
    const bad = structuredClone(r);
    bad.signature = "broken";
    expect(verifyReceipt(bad).valid).toBe(false);
  });
});
describe("transparent alert rules", () => {
  it("evaluates thresholds only when data exists", async () => {
    const a = await analyze(
      scanSchema.parse({ mint: DEMO_MINT, mode: "demo" }),
    );
    expect(
      alertTriggered(
        { id: "1", kind: "gap_above", threshold: 15, cooldown_minutes: 60 },
        a,
      ),
    ).toBe(true);
    expect(
      alertTriggered(
        { id: "1", kind: "gap_above", threshold: 20, cooldown_minutes: 60 },
        a,
      ),
    ).toBe(false);
    const missing = { ...a, values: { ...a.values, gapPercent: null } };
    expect(
      alertTriggered(
        { id: "1", kind: "gap_above", threshold: 0, cooldown_minutes: 60 },
        missing,
      ),
    ).toBe(false);
    expect(
      alertTriggered(
        { id: "1", kind: "gap_increase", threshold: 5, cooldown_minutes: 60 },
        a,
      ),
    ).toBe(false);
    expect(
      alertTriggered(
        { id: "1", kind: "gap_increase", threshold: 5, cooldown_minutes: 60 },
        a,
        { ...a, values: { ...a.values, gapPercent: "1" } },
      ),
    ).toBe(true);
  });
  it("deduplicates within a cooldown bucket", () => {
    expect(dedupeKey("r1", 10000, 60)).toBe(dedupeKey("r1", 30000, 60));
    expect(dedupeKey("r1", 10000, 60)).not.toBe(dedupeKey("r2", 10000, 60));
    expect(dedupeKey("r1", 10000, 60)).not.toBe(dedupeKey("r1", 3700000, 60));
  });
});
