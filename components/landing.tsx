"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileCheck2,
  FlaskConical,
  GitCompareArrows,
  Layers3,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Lookup } from "./scanner/lookup";
import { Button } from "./ui/button";
import { money } from "@/lib/utils";
import { SCENARIOS } from "@/lib/demo";
export function Landing() {
  const [size, setSize] = useState(2000);
  const exit = size / (1 + size / ((2000 * 0.82) / 0.18));
  const gap = size - exit;
  return (
    <div className="landing">
      <div className="intro-line">
        <span>
          <i className="dot" />
          THE SOLANA MARKET REALITY PLATFORM
        </span>
        <span className="version">
          Independent by design <ArrowUpRight size={12} />
        </span>
      </div>
      <section className="hero">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hero-copy"
        >
          <div className="hero-kicker">
            <span className="line" />
            LOOK BEYOND THE MARKET CAP
          </div>
          <h1>
            THE CHART SAYS
            <br />
            YOU’RE RICH.
            <br />
            <span>
              BUT CAN YOU
              <br className="hero-br" /> CASH OUT?
            </span>
          </h1>
          <p>
            Your market cap isn’t your exit liquidity.
            <br />
            See what your memecoin position may actually sell for.
            <br className="desktop-break" /> Compare the data. Measure the gap.
            Know your exit.
          </p>
          <Lookup large />
          <div className="hero-meta">
            <span>
              <ShieldCheck size={13} />
              No wallet connection
            </span>
            <span>
              <Check size={13} />
              Free to scan
            </span>
            <Link href="/scan?demo=poor">
              Try live demo <ArrowUpRight size={13} />
            </Link>
          </div>
        </motion.div>
        <motion.div
          className="terminal-preview"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
        >
          <div className="terminal-title">
            <span>
              <span className="tiny-brand" />
              EXIT REALITY CHECK
            </span>
            <span className="badge demo">
              <FlaskConical size={10} />
              DEMO
            </span>
          </div>
          <div className="preview-token">
            <span className="token-avatar">
              E<span />
            </span>
            <div>
              <strong>$EXAMPLE</strong>
              <small>Fictional token · Solana</small>
            </div>
            <span className="badge warning">
              <span className="dot" />
              HIGH DISCREPANCY
            </span>
          </div>
          <div className="preview-values">
            <div>
              <span>Displayed position value</span>
              <strong>{money(String(size))}</strong>
              <small>What the chart tells you</small>
            </div>
            <ArrowDownRight className="value-arrow" size={26} />
            <div>
              <span>Estimated sell proceeds</span>
              <strong className="lime">{money(String(exit))}</strong>
              <small>What a quote suggests</small>
            </div>
          </div>
          <div className="gap-callout">
            <span>
              <TrendingDown size={17} />
              The reality gap
            </span>
            <strong>
              −{money(String(gap))}{" "}
              <small>({((gap / size) * 100).toFixed(1)}%)</small>
            </strong>
          </div>
          <div className="preview-bars">
            <div>
              <span>On your screen</span>
              <span>{money(String(size))}</span>
            </div>
            <div className="bar display-bar">
              <i />
            </div>
            <div>
              <span>At your exit</span>
              <span>{money(String(exit))}</span>
            </div>
            <div className="bar">
              <i style={{ width: `${(exit / size) * 100}%` }} />
              <b style={{ width: `${(gap / size) * 100}%` }} />
            </div>
            <div className="bar-legend">
              <span>
                <i />
                Quoted proceeds
              </span>
              <span>
                <i />
                Unrealized difference
              </span>
            </div>
          </div>
          <div className="preview-facts">
            <div>
              <span>Price impact</span>
              <strong className="amber">
                {((gap / size) * 100).toFixed(1)}%
              </strong>
            </div>
            <div>
              <span>Quote age</span>
              <strong>Simulated</strong>
            </div>
            <div>
              <span>Routes</span>
              <strong>1 simulated</strong>
            </div>
            <div>
              <span>Liquidity</span>
              <strong>
                $182.2K <small>demo</small>
              </strong>
            </div>
          </div>
          <div className="preview-slider">
            <label htmlFor="preview-size">
              Test a position size <strong>{money(String(size))}</strong>
            </label>
            <input
              id="preview-size"
              type="range"
              min="100"
              max="5000"
              step="100"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
            <div>
              <span>$100</span>
              <span>$5,000</span>
            </div>
          </div>
          <div className="preview-note">
            <FlaskConical size={12} />
            SIMULATED DATA · Illustrative estimate, not a live quote
          </div>
        </motion.div>
      </section>
      <div className="source-strip">
        <span>THREE SOURCES. A CLEARER PICTURE.</span>
        <div>
          <span className="provider-word">
            <span className="provider-shape" />
            DEX Screener
          </span>
          <span className="source-plus">+</span>
          <span className="provider-word">
            <span className="gecko-shape" />
            GeckoTerminal
          </span>
          <span className="source-plus">+</span>
          <span className="provider-word">
            <span className="jupiter-shape" />
            Jupiter
          </span>
        </div>
        <Link href="/methodology#sources">
          How we use the data <ArrowUpRight size={13} />
        </Link>
      </div>
      <section className="features-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE PRICE IS ONLY HALF THE STORY</div>
            <h2>See the price behind the price.</h2>
          </div>
          <p>
            Less guesswork. More context.
            <br />
            An independent lens on your next decision.
          </p>
        </div>
        <div className="feature-grid">
          {[
            {
              icon: Wallet,
              n: "01",
              title: "Measure before you sell.",
              body: "Test your position against a current USDC sell quote. See the gap between displayed value and estimated proceeds.",
              link: "/scan",
              cta: "Explore the scanner",
            },
            {
              icon: GitCompareArrows,
              n: "02",
              title: "One token. Multiple realities.",
              body: "Compare matching pools across independent sources. See differences, missing context, and exactly when data was collected.",
              link: "/compare",
              cta: "Compare sources",
            },
            {
              icon: FileCheck2,
              n: "03",
              title: "Every claim needs evidence.",
              body: "Capture a timestamped market receipt. Inspect its inputs, download the evidence, and verify that it has not been altered.",
              link: "/receipts",
              cta: "Explore receipts",
            },
          ].map(({ icon: Icon, ...f }) => (
            <Link href={f.link} className="feature" key={f.n}>
              <div>
                <span className="feature-icon">
                  <Icon size={22} />
                </span>
                <span className="feature-number">{f.n}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
              <span className="feature-cta">
                {f.cta}
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="scenarios-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <FlaskConical size={13} />
              NO CREDENTIALS NEEDED
            </div>
            <h2>Get a feel for the gap.</h2>
          </div>
          <span className="badge demo">DEMO / SIMULATED DATA</span>
        </div>
        <div className="scenario-table">
          <div className="scenario-table-head">
            <span>SCENARIO</span>
            <span>WHAT YOU’LL EXPLORE</span>
            <span>OPEN ANALYSIS</span>
          </div>
          {SCENARIOS.slice(0, 4).map((s, i) => (
            <Link href={`/scan?demo=${s.id}`} key={s.id}>
              <div>
                <span className={`scenario-symbol s-${i}`}>
                  {["EX", "DP", "DV", "NR"][i]}
                </span>
                <strong>{s.name}</strong>
                <span className="badge neutral">DEMO</span>
              </div>
              <p>{s.description}</p>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>
      <section className="community-section">
        <div className="community-mark">
          <Layers3 size={38} />
        </div>
        <div>
          <div className="eyebrow">BUILT FOR THE TRENCHES</div>
          <h2>Powered by transparent data.</h2>
          <p>
            $CAPGAP is a community brand with a simple belief: better
            information should be available to everyone. The basic scanner stays
            free. Useful with or without a token.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/about">
            Meet CAPGAP
            <ArrowRight size={15} />
          </Link>
        </Button>
      </section>
      <div className="landing-disclaimer">
        <ShieldCheck size={15} />
        <p>
          CAPGAP provides market-data comparisons and quote estimates. It does
          not execute trades, predict returns, or guarantee that a sale will
          succeed.{" "}
          <Link href="/methodology">
            Understand the methodology
            <ChevronRight size={11} />
          </Link>
        </p>
      </div>
    </div>
  );
}
