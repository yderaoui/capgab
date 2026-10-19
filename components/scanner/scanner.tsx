"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, FlaskConical, ScanLine } from "lucide-react";
import { PageHeading } from "../layout/shell";
import { Lookup } from "./lookup";
import { TokenAnalysis } from "../token/analysis";
import { DEMO_MINT, SCENARIOS } from "@/lib/demo";
export function Scanner({ compare = false }: { compare?: boolean }) {
  const params = useSearchParams();
  const demo = SCENARIOS.find((s) => s.id === params.get("demo"))?.id;
  return (
    <div className="page-container">
      <PageHeading
        eyebrow={compare ? "SOURCE TRANSPARENCY" : "KNOW YOUR EXIT"}
        title={compare ? "Compare market data." : "Look beyond the chart."}
        description={
          compare
            ? "Inspect same-pool observations side by side. Missing timestamps, unmatched markets, and different valuation definitions stay visible."
            : "Paste a Solana mint address. Compare market observations and request an exact-size USDC exit estimate."
        }
      />
      <Lookup />
      {demo ? (
        <TokenAnalysis
          key={demo}
          mint={DEMO_MINT}
          demo={demo}
          comparisonOnly={compare}
        />
      ) : (
        <>
          <div className="panel section-spacer">
            <div className="panel-body">
              <div className="eyebrow">
                <FlaskConical size={13} />
                DEMO / SIMULATED DATA
              </div>
              <h2>Explore the market realities.</h2>
              <p style={{ marginTop: 10 }}>
                No account or API key needed. Seven fictional scenarios, the
                same calculation engine.
              </p>
              <div className="scenario-cards">
                {SCENARIOS.map((s) => (
                  <Link
                    className="scenario-card"
                    href={`${compare ? "/compare" : "/scan"}?demo=${s.id}`}
                    key={s.id}
                  >
                    <span className="badge demo">DEMO</span>
                    <h3>{s.name}</h3>
                    <p>{s.description}</p>
                    <span className="open-label">
                      Open analysis
                      <ArrowUpRight size={13} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="notice section-spacer">
            <ScanLine size={16} />
            Scanning is read-only. CAPGAP never asks for a wallet signature or
            executes transactions. Provider errors are surfaced directly.
          </div>
        </>
      )}
    </div>
  );
}
