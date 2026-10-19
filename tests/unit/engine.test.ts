import { describe, it, expect } from "vitest";
import { calculateExit, comparePools, diagnose } from "@/lib/calculations";
import { fromAtomic, toAtomic, validMint, SOL_MINT } from "@/lib/solana";
import { demoMarket, DEMO_MINT } from "@/lib/demo";
import { analyze } from "@/lib/engine";
import { scanSchema } from "@/lib/validation";
describe("Solana exact amounts", () => {
  it("validates 32-byte base58, including off-curve addresses", () => {
    expect(validMint(SOL_MINT)).toBe(true);
    expect(validMint(DEMO_MINT)).toBe(true);
    expect(validMint("0x123")).toBe(false);
    expect(validMint("1111")).toBe(false);
    expect(validMint("0".repeat(44))).toBe(false);
  });
  it.each([
    ["1.234567", 6, "1234567"],
    ["9007199254740993.123456789", 9, "9007199254740993123456789"],
    ["0.000000001", 9, "1"],
    ["23", 0, "23"],
    ["1.2300", 2, "123"],
  ])("converts %s at %d decimals exactly", (v, d, raw) => {
    expect(toAtomic(v, d)).toBe(raw);
  });
  it("normalizes atomic units without floating point", () => {
    expect(fromAtomic("1000000", 6)).toBe("1");
    expect(fromAtomic("1", 9)).toBe("0.000000001");
    expect(fromAtomic("0", 6)).toBe("0");
    expect(fromAtomic("100", 0)).toBe("100");
  });
  it("rejects precision loss, exponent notation and negatives", () => {
    expect(() => toAtomic("1.0001", 2)).toThrow();
    expect(() => toAtomic("1e9", 6)).toThrow();
    expect(() => toAtomic("-1", 6)).toThrow();
  });
});
describe("exit valuation", () => {
  it("calculates 18% gap using quantities and independent USDC conversion", () => {
    const x = calculateExit("1000000", "0.002", "1640");
    expect(x.displayedValue).toBe("2000");
    expect(x.exitValue).toBe("1640");
    expect(x.dollarGap).toBe("360");
    expect(x.gapPercent).toBe("18");
  });
  it("preserves a favorable negative gap", () => {
    const x = calculateExit("100", "1", "105");
    expect(x.gapPercent).toBe("-5");
    expect(x.dollarGap).toBe("-5");
  });
  it("does not divide by zero or substitute missing values", () => {
    expect(calculateExit("1", "1", "not-a-number").exitValue).toBeNull();
    expect(calculateExit("0", "1", "10").gapPercent).toBeNull();
    expect(calculateExit("1", null, "10").displayedValue).toBeNull();
    expect(calculateExit("10", "2", null).exitValue).toBeNull();
    expect(calculateExit("10", "2", null).displayedValue).toBe("20");
  });
  it("handles non-par USDC and tiny prices", () => {
    expect(calculateExit("100", "1", "100", "0.98").gapPercent).toBe("2");
    expect(
      calculateExit("1000000000000000000", "0.000000000000000001", "1")
        .displayedValue,
    ).toBe("1");
  });
});
describe("semantic market matching", () => {
  const a = demoMarket("poor")[0].snapshots[0];
  const b = demoMarket("poor")[1].snapshots[0];
  it("compares aligned same-pool observations symmetrically", () => {
    const result = comparePools(a, b);
    expect(result.comparable).toBe(true);
    expect(Number(result.deviation)).toBeCloseTo(0.1998, 3);
  });
  it("does not compare unknown times, mismatched pools or quote assets", () => {
    expect(comparePools(a, { ...b, observedAt: null }).deviation).toBeNull();
    expect(comparePools(a, { ...b, pool: DEMO_MINT }).comparable).toBe(false);
    expect(comparePools(a, { ...b, quoteMint: DEMO_MINT }).comparable).toBe(
      false,
    );
    expect(
      comparePools(a, {
        ...b,
        observedAt: new Date(Date.parse(a.observedAt!) - 60000).toISOString(),
      }).comparable,
    ).toBe(false);
  });
});
describe("shared analysis engine", () => {
  it("produces deterministic demo values with amount-specific quotes", async () => {
    const a = await analyze(
      scanSchema.parse({ mint: DEMO_MINT, mode: "demo", amount: "2000" }),
    );
    expect(Number(a.values.exitValue)).toBeCloseTo(1640, 5);
    expect(a.diagnostic.status).toBe("HIGH DISCREPANCY");
    const b = await analyze(
      scanSchema.parse({ mint: DEMO_MINT, mode: "demo", amount: "100" }),
    );
    expect(Number(b.values.gapPercent)).toBeLessThan(
      Number(a.values.gapPercent),
    );
    expect(Number(b.values.exitValue)).not.toBe(
      Number(a.values.exitValue) / 20,
    );
  });
  it("distinguishes missing routes from stale data", async () => {
    const base = { mint: DEMO_MINT, mode: "demo" };
    const a = await analyze(
      scanSchema.parse({ ...base, scenario: "no-route" }),
    );
    expect(a.quote.outAmount).toBeNull();
    expect(a.values.exitValue).toBeNull();
    expect(a.diagnostic.status).toBe("QUOTE UNAVAILABLE");
    const b = await analyze(scanSchema.parse({ ...base, scenario: "stale" }));
    expect(b.diagnostic.status).toBe("DATA STALE");
  });
  it("does not warn on negative gaps solely for their magnitude", async () => {
    const a = await analyze(
      scanSchema.parse({ mint: DEMO_MINT, mode: "demo", scenario: "healthy" }),
    );
    const v = { ...a.values, gapPercent: "-20" };
    expect(diagnose(v, a.quote, a.comparison, a.reference).status).toBe(
      "NORMAL",
    );
  });
  it("rejects extra payload fields and u64 overflow", async () => {
    expect(() =>
      scanSchema.parse({ mint: DEMO_MINT, quote: "fake" }),
    ).toThrow();
    await expect(
      analyze(
        scanSchema.parse({
          mint: DEMO_MINT,
          mode: "demo",
          input: "tokens",
          amount: "18446744073709551616",
        }),
      ),
    ).rejects.toThrow("u64");
  });
});
