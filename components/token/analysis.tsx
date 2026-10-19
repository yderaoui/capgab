"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  FileCheck2,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingDown,
} from "lucide-react";
import type { Analysis, Receipt, Scenario, Snapshot } from "@/lib/models";
import type { ScanInput } from "@/lib/validation";
import { SCENARIOS, DEMO_MINT } from "@/lib/demo";
import { money, shorten } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { ComparisonHistory } from "../comparison-history";
const Chart = dynamic(() => import("../charts/sensitivity"), {
  ssr: false,
  loading: () => <div className="skeleton" />,
});
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Request failed.");
  return data;
}
export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      className="copy-btn"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setFailed(true);
        }
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}{" "}
      {failed ? "Copy unavailable" : copied ? "Copied" : label}
    </button>
  );
}
export function ComparisonTable({ analysis: a }: { analysis: Analysis }) {
  const pool = a.pool;
  const l = a.providers[0]?.snapshots.find((s) => s.pool === pool);
  const r = a.providers[1]?.snapshots.find((s) => s.pool === pool);
  const rows: {
    label: string;
    key: keyof Snapshot;
    type?: "money" | "time";
  }[] = [
    { label: "Pool address", key: "pool" },
    { label: "Price · USD / token", key: "price", type: "money" },
    { label: "Market capitalization", key: "marketCap", type: "money" },
    { label: "Fully diluted valuation", key: "fdv", type: "money" },
    { label: "Pool liquidity", key: "liquidity", type: "money" },
    { label: "Volume · 24 hours", key: "volume24h", type: "money" },
    { label: "Pool created at", key: "poolCreatedAt", type: "time" },
    { label: "Source observation time", key: "observedAt", type: "time" },
    { label: "API retrieved at", key: "retrievedAt", type: "time" },
  ];
  function cell(s: Snapshot | undefined, row: (typeof rows)[number]) {
    const v = s?.[row.key];
    if (v == null) return "Unknown";
    return row.type === "money"
      ? money(String(v))
      : row.type === "time"
        ? new Date(String(v)).toLocaleString()
        : row.key === "pool"
          ? shorten(String(v))
          : String(v);
  }
  return (
    <div className="panel">
      <div className="panel-heading">
        <h2>Cross-provider comparison</h2>
        <span
          className={`badge ${a.comparison.comparable ? "success" : "warning"}`}
        >
          {a.comparison.comparable ? "MATCHED OBSERVATIONS" : "PARTIAL"}
        </span>
      </div>
      <p className="comparison-notice">{a.comparison.reason}</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>METRIC</th>
              <th>DEXSCREENER</th>
              <th>GECKOTERMINAL</th>
              <th>DIFFERENCE / STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td title={String(l?.[row.key] ?? "")}>{cell(l, row)}</td>
                <td title={String(r?.[row.key] ?? "")}>{cell(r, row)}</td>
                <td className="muted">
                  {row.key === "price" && a.comparison.comparable
                    ? `${Number(a.comparison.deviation).toFixed(3)}%`
                    : "Not directly comparable"}
                  {row.key === "marketCap" && (
                    <small>Circulating supply methodology may differ</small>
                  )}
                  {row.key === "liquidity" && (
                    <small>Reserve definitions may differ</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.providers.map((p) => (
        <div key={p.source}>
          {p.error && (
            <div className="source-error">
              {p.source}: {p.error}
            </div>
          )}
          <div className="source-status">
            <span>
              {p.source} · {p.status} · {p.latencyMs}ms retrieval
            </span>
            {p.snapshots.find((s) => s.pool === a.pool) && (
              <a
                href={p.snapshots.find((s) => s.pool === a.pool)!.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inspect source ↗
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
export function TokenAnalysis({
  mint,
  demo,
  comparisonOnly = false,
}: {
  mint: string;
  demo?: Scenario;
  comparisonOnly?: boolean;
}) {
  const [amount, setAmount] = useState("2000");
  const [input, setInput] = useState<"usd" | "tokens">("usd");
  const [scenario, setScenario] = useState<Scenario>(demo ?? "poor");
  const [pool, setPool] = useState<string>();
  const [actionMessage, setActionMessage] = useState("");
  const [last, setLast] = useState<Analysis | null>(null);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState(0);
  const [points, setPoints] = useState<
    { size: number; displayed: number; exit: number | null }[]
  >([]);
  const [chartBusy, setChartBusy] = useState(false);
  const router = useRouter();
  const addScan = useStore((s) => s.addScan);
  const addWatch = useStore((s) => s.addWatch);
  const addReceipt = useStore((s) => s.addReceipt);
  const payload = (overrides: Partial<ScanInput> = {}): ScanInput => ({
    mint: demo ? DEMO_MINT : mint,
    mode: demo ? "demo" : "live",
    scenario,
    amount,
    input,
    ...(pool ? { pool } : {}),
    ...overrides,
  });
  const mutation = useMutation({
    mutationFn: (body: ScanInput) =>
      apiFetch<Analysis>("/api/v1/scan", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (a) => {
      setLast((previous) =>
        a.quote.status === "RATE_LIMITED" &&
        previous?.quote.status === "AVAILABLE"
          ? previous
          : a,
      );
      addScan(a);
      setPaused(a.quote.status === "RATE_LIMITED");
      if (a.quote.status === "RATE_LIMITED")
        setActionMessage(
          "New quote request was rate limited. The last collected analysis remains visible for its original token quantity; the new size has not been quoted.",
        );
    },
  });
  useEffect(() => {
    const abort = new AbortController();
    apiFetch<Analysis>("/api/v1/scan", {
      method: "POST",
      body: JSON.stringify({
        mint: demo ? DEMO_MINT : mint,
        mode: demo ? "demo" : "live",
        scenario: demo ?? "poor",
        amount: "2000",
        input: "usd",
      }),
      signal: abort.signal,
    })
      .then((a) => {
        setLast(a);
        addScan(a);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setActionMessage(e.message);
      });
    return () => abort.abort();
  }, [mint, demo, addScan]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const receiptMutation = useMutation({
    mutationFn: () =>
      apiFetch<Receipt>("/api/v1/receipts", {
        method: "POST",
        body: JSON.stringify(payload()),
      }),
    onSuccess: (r) => {
      addReceipt(r);
      router.push(`/receipt/${r.content.id}`);
    },
  });
  async function save() {
    if (!last) return;
    if (last.mode === "demo") {
      addWatch({
        id: scenario,
        mint: last.token.mint,
        name: last.token.name,
        symbol: last.token.symbol,
        position: last.values.displayedValue ?? "1000",
        scenario,
      });
      setActionMessage("Demo token saved in this browser.");
      return;
    }
    try {
      await apiFetch("/api/v1/watchlist", {
        method: "POST",
        body: JSON.stringify({
          mint: last.token.mint,
          name: last.token.name,
          symbol: last.token.symbol,
          position: last.values.displayedValue ?? "1000",
          pool: last.pool,
          mode: "live",
        }),
      });
      setActionMessage("Saved to your watchlist.");
    } catch (e) {
      setActionMessage((e as Error).message);
    }
  }
  async function buildCurve() {
    setChartBusy(true);
    setPoints([]);
    try {
      const data = [];
      for (const size of [25, 100, 500, 1000, 5000]) {
        const result = await apiFetch<Analysis>("/api/v1/exit-analysis", {
          method: "POST",
          body: JSON.stringify(payload({ amount: String(size), input: "usd" })),
        });
        data.push({
          size,
          displayed: Number(result.values.displayedValue ?? size),
          exit:
            result.values.exitValue == null
              ? null
              : Number(result.values.exitValue),
        });
        setPoints([...data]);
        if (result.quote.status === "RATE_LIMITED") {
          setPaused(true);
          break;
        }
      }
    } catch (e) {
      setActionMessage((e as Error).message);
    } finally {
      setChartBusy(false);
    }
  }
  const a = last;
  const busy = mutation.isPending;
  const age = a
    ? Math.max(
        0,
        Math.floor(
          ((clock || Date.parse(a.capturedAt)) -
            Date.parse(a.quote.collectedAt)) /
            1000,
        ),
      )
    : 0;
  const stale = age > 15;
  if (!a)
    return (
      <>
        {actionMessage ? (
          <div className="notice">
            <AlertTriangle size={17} />
            {actionMessage}
          </div>
        ) : (
          <>
            <div className="skeleton" />
            <p className="small-note">
              Collecting independent market observations and a quote for this
              position…
            </p>
          </>
        )}
      </>
    );
  const pools = Array.from(
    new Map(
      a.providers.flatMap((p) => p.snapshots).map((s) => [s.pool, s]),
    ).values(),
  );
  return (
    <>
      {demo && (
        <div className="notice demo-notice">
          <FlaskConical size={16} />
          <div>
            <strong>DEMO / SIMULATED DATA</strong> · Fictional token, prices,
            and execution curve. Local previews never enter production
            analytics.
            <br />
            Choose a scenario below to explore different market conditions.
          </div>
        </div>
      )}
      <div className="token-header">
        <span className="token-avatar">{a.token.symbol.charAt(0)}</span>
        <div>
          <h1>${a.token.symbol}</h1>
          <small>
            {a.token.name}
            <span>·</span>Solana{" "}
            <span className="mono">{shorten(a.token.mint)}</span>
            <CopyButton value={a.token.mint} label="Copy mint" />
          </small>
        </div>
        <span
          className={`badge ${demo ? "demo" : stale ? "warning" : "success"}`}
        >
          {demo ? "DEMO" : stale ? "STALE" : "PARTIAL · SOURCE AGE UNKNOWN"}
        </span>
        <div className="token-actions">
          <Button variant="outline" size="sm" onClick={save}>
            <Star size={13} />
            Save token
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || paused}
            onClick={() => mutation.mutate(payload())}
          >
            <RefreshCw size={13} className={busy ? "spin" : ""} />
            {busy ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>
      {actionMessage && (
        <p className="small-note" role="status">
          {actionMessage}
        </p>
      )}
      {mutation.error && (
        <p className="error-text" role="alert">
          {mutation.error.message}
        </p>
      )}
      {paused && (
        <div className="notice">
          <AlertTriangle size={16} />
          <div>
            Quote requests paused after a rate limit. Last collected results
            remain visible with their age.{" "}
            <button className="inline-link" onClick={() => setPaused(false)}>
              Resume requests
            </button>
          </div>
        </div>
      )}
      <div className="data-timestamp">
        Captured {new Date(a.capturedAt).toLocaleString()} · Methodology 1.0.0 ·
        Quote collected {age}s ago {stale ? "· STALE" : ""}
      </div>
      {demo && (
        <div className="toolbar section-spacer">
          <label className="form-label" htmlFor="scenario-select">
            Demo scenario
          </label>
          <select
            id="scenario-select"
            value={scenario}
            onChange={(e) => {
              const s = e.target.value as Scenario;
              setScenario(s);
              setPoints([]);
              mutation.mutate(payload({ scenario: s }));
            }}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {comparisonOnly ? (
        <div className="section-spacer">
          <ComparisonTable analysis={a} />
          {a.mode === "live" && (
            <ComparisonHistory mint={a.token.mint} pool={a.pool} />
          )}
        </div>
      ) : (
        <>
          <div className="metric-grid section-spacer">
            <div className="metric-card">
              <span>DISPLAYED POSITION VALUE</span>
              <strong>{money(a.values.displayedValue)}</strong>
              <small>
                {a.reference?.source ?? "No source"} ·{" "}
                {money(a.values.referencePrice)} / token
              </small>
            </div>
            <div className="metric-card highlight">
              <span>QUOTED EXPECTED PROCEEDS</span>
              <strong className="lime">{money(a.values.exitValue)}</strong>
              <small>
                {a.quote.router ?? "No route"} · USDC → USD{" "}
                {demo ? "· DEMO" : ""}
              </small>
            </div>
            <div className="metric-card">
              <span>DISPLAYED VALUE − QUOTED EXIT</span>
              <strong
                className={Number(a.values.gapPercent) > 0 ? "amber" : "mint"}
              >
                {a.values.gapPercent == null
                  ? "Unknown"
                  : `${Number(a.values.gapPercent).toFixed(2)}%`}
              </strong>
              <small>
                {money(a.values.dollarGap)} difference · fees shown separately
              </small>
            </div>
          </div>
          <div className="analysis-grid">
            <div className="stack">
              <div className="panel">
                <div className="panel-heading">
                  <h2>Your position. Its actual context.</h2>
                  <span className="badge warning">
                    {stale ? "DATA STALE" : a.diagnostic.status}
                  </span>
                </div>
                <div className="analysis-gap-bars">
                  <div>
                    <span>Displayed value</span>
                    <span>{money(a.values.displayedValue)}</span>
                  </div>
                  <div className="bar display-bar">
                    <i />
                  </div>
                  <div>
                    <span>Quoted expected proceeds</span>
                    <span>{money(a.values.exitValue)}</span>
                  </div>
                  <div className="bar">
                    <i
                      style={{
                        width:
                          a.values.exitValue && a.values.displayedValue
                            ? `${Math.min(100, Math.max(0, (Number(a.values.exitValue) / Number(a.values.displayedValue)) * 100))}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
                <div className="diagnostic">
                  <h3>
                    <TrendingDown size={15} />
                    {stale
                      ? "This quote is stale. Refresh before assessing an exit."
                      : a.diagnostic.status}
                  </h3>
                  {a.diagnostic.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              </div>
              <ComparisonTable analysis={a} />
              <div className="panel">
                <div className="panel-heading">
                  <h2>Position-size sensitivity</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={buildCurve}
                    disabled={chartBusy || paused}
                  >
                    {chartBusy ? "Collecting quotes…" : "Quote 5 sizes"}
                  </Button>
                </div>
                {points.length ? (
                  <Chart points={points} />
                ) : (
                  <div className="empty-state" style={{ padding: "30px" }}>
                    <TrendingDown size={24} />
                    <p>
                      Collect a separate quote for $25, $100, $500, $1,000, and
                      $5,000. Each point uses its own exact input amount.
                    </p>
                  </div>
                )}
                <div className="panel-body">
                  <p className="small-note">
                    {demo
                      ? "DEMO: illustrative curves from a fictional reserve model. "
                      : "Live quotes are collected sequentially to respect provider limits. "}
                    Estimated proceeds at the quoted time. Not guaranteed
                    execution. Missing quotes remain gaps in the chart.
                  </p>
                </div>
              </div>
            </div>
            <div className="stack">
              <div className="panel">
                <div className="panel-heading">
                  <h2>Exit size simulator</h2>
                  <span className="badge neutral">USDC OUTPUT</span>
                </div>
                <form
                  className="panel-body"
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutation.mutate(payload());
                  }}
                >
                  <div className="segmented">
                    <button
                      type="button"
                      className={input === "usd" ? "selected" : ""}
                      onClick={() => {
                        setInput("usd");
                        setAmount(a.values.displayedValue ?? "2000");
                      }}
                    >
                      Position in USD
                    </button>
                    <button
                      type="button"
                      className={input === "tokens" ? "selected" : ""}
                      onClick={() => {
                        setInput("tokens");
                        setAmount(a.values.quantity);
                      }}
                    >
                      Token quantity
                    </button>
                  </div>
                  <label className="form-label" htmlFor="position-size">
                    {input === "usd"
                      ? "Approximate displayed value"
                      : "Number of tokens"}
                  </label>
                  <div className="position-input">
                    <span>{input === "usd" ? "$" : "#"}</span>
                    <input
                      id="position-size"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="presets">
                    {[25, 100, 500, 1000, 5000].map((n) => (
                      <button
                        type="button"
                        key={n}
                        onClick={() => {
                          setInput("usd");
                          setAmount(String(n));
                          mutation.mutate(
                            payload({ input: "usd", amount: String(n) }),
                          );
                        }}
                        disabled={busy || paused}
                      >
                        ${n.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <label className="form-label" htmlFor="reference-pool">
                    Reference pool
                  </label>
                  <select
                    id="reference-pool"
                    className="full-width"
                    style={{ fontSize: 10, marginBottom: 18 }}
                    value={pool ?? a.pool ?? ""}
                    onChange={(e) => {
                      setPool(e.target.value);
                      setPoints([]);
                      mutation.mutate(payload({ pool: e.target.value }));
                    }}
                  >
                    {pools.length ? (
                      pools.map((p) => (
                        <option value={p.pool} key={p.pool}>
                          {p.dex} · {shorten(p.pool)} ·{" "}
                          {money(p.liquidity, true)}
                        </option>
                      ))
                    ) : (
                      <option value="">No priced pools found</option>
                    )}
                  </select>
                  <Button
                    type="submit"
                    className="full-width"
                    disabled={busy || paused}
                  >
                    {busy
                      ? "Requesting exact-size quote…"
                      : "Calculate my exit"}
                    <ArrowRight size={14} />
                  </Button>
                  <p className="small-note">
                    {a.values.quantity} tokens evaluated. The reference pool
                    sets the displayed price; Jupiter may route through other
                    markets.
                  </p>
                </form>
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Quote details</h2>
                  <span
                    className={`badge ${a.quote.status === "AVAILABLE" ? "success" : "warning"}`}
                  >
                    {stale ? "STALE" : a.quote.status}
                  </span>
                </div>
                <div className="panel-body">
                  <dl className="details-list">
                    <div>
                      <dt>Collection time</dt>
                      <dd>
                        {new Date(a.quote.collectedAt).toLocaleTimeString()} ·{" "}
                        {age}s ago
                      </dd>
                    </div>
                    <div>
                      <dt>Router</dt>
                      <dd>{a.quote.router ?? "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Route labels</dt>
                      <dd>{a.quote.routes.join(", ") || "Not supplied"}</dd>
                    </div>
                    <div>
                      <dt>Reported price impact</dt>
                      <dd>
                        {a.quote.priceImpact == null
                          ? "Unknown"
                          : `${a.quote.priceImpact}%`}
                      </dd>
                    </div>
                    <div>
                      <dt>Slippage tolerance</dt>
                      <dd>
                        {a.quote.slippageBps == null
                          ? "Unknown"
                          : `${a.quote.slippageBps / 100}%`}
                      </dd>
                    </div>
                    <div>
                      <dt>Minimum output parameter</dt>
                      <dd>
                        {a.quote.minimumOutput ?? "Not supplied"}{" "}
                        {a.quote.minimumOutput ? "atomic USDC" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Reported fee rate</dt>
                      <dd>
                        {a.quote.feeBps == null
                          ? "Unknown"
                          : `${a.quote.feeBps} bps`}
                      </dd>
                    </div>
                    <div>
                      <dt>Network fee / priority</dt>
                      <dd>
                        {a.quote.signatureFeeLamports ?? "Unknown"} /{" "}
                        {a.quote.priorityFeeLamports ?? "Unknown"} lamports
                      </dd>
                    </div>
                    <div>
                      <dt>Rent cost</dt>
                      <dd>{a.quote.rentFeeLamports ?? "Unknown"} lamports</dd>
                    </div>
                  </dl>
                  {a.quote.error && (
                    <p className="error-text">{a.quote.error}</p>
                  )}
                  <p className="small-note">
                    {a.values.conversionBasis} Minimum output is a transaction
                    parameter, not a guaranteed received amount.
                  </p>
                </div>
              </div>
              <div className="panel">
                <div className="panel-body">
                  <FileCheck2 size={23} className="lime" />
                  <h3 style={{ margin: "15px 0 10px", fontSize: 16 }}>
                    Capture the evidence.
                  </h3>
                  <p>
                    Preserve a fresh server-collected quote and its calculation
                    inputs.
                  </p>
                  <Button
                    className="full-width"
                    variant="outline"
                    style={{ marginTop: 20 }}
                    onClick={() => receiptMutation.mutate()}
                    disabled={receiptMutation.isPending}
                  >
                    {receiptMutation.isPending
                      ? "Collecting & signing…"
                      : demo
                        ? "Generate demo receipt"
                        : "Generate receipt"}
                    <FileCheck2 size={14} />
                  </Button>
                  {receiptMutation.error && (
                    <p className="error-text">
                      {receiptMutation.error.message}
                    </p>
                  )}
                  <p className="small-note">
                    {demo
                      ? "Signed demo previews use an ephemeral key and browser-local copy. They are excluded from the public live explorer."
                      : "Live issuance requires sign-in, persistent storage, and a server signing key."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="panel section-spacer">
        <div className="panel-heading">
          <h2>
            <ShieldCheck
              size={15}
              style={{ display: "inline", marginRight: 8 }}
            />
            Know the limits of this analysis
          </h2>
          <Link className="inline-link" href="/methodology">
            Methodology
            <ArrowRight size={12} />
          </Link>
        </div>
        <div className="panel-body">
          {a.limitations.map((l) => (
            <p className="small-note" key={l} style={{ marginTop: 8 }}>
              {l}
            </p>
          ))}
        </div>
      </div>
    </>
  );
}
