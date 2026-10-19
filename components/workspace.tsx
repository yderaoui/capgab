"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { PageHeading } from "./layout/shell";
import { Button } from "./ui/button";
import { apiFetch } from "./token/analysis";
import { authConfigured, browserAuth, useAccount } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { DEMO_MINT } from "@/lib/demo";
import { money, shorten } from "@/lib/utils";
import { z } from "zod";
import { alertSchema, watchSchema } from "@/lib/validation";
import type { Analysis } from "@/lib/models";
import dynamic from "next/dynamic";
const GapHistory = dynamic(() => import("./charts/gap-history"), {
  ssr: false,
});
const subscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
interface WatchRow {
  id: string;
  mint: string;
  name: string;
  symbol: string;
  position: string;
  scenario?: string;
  pool?: string | null;
}
interface RuleRow {
  id: string;
  mint: string;
  kind: string;
  threshold: number;
  enabled: boolean;
}
const kinds = [
  ["gap_above", "Exit gap above (%)"],
  ["liquidity_below", "Pool liquidity below (USD)"],
  ["quote_unavailable", "USDC quote unavailable"],
  ["provider_deviation", "Comparable provider deviation above (%)"],
  ["stale", "Data becomes stale"],
  ["liquidity_drop", "Liquidity decrease above (%)"],
  ["gap_increase", "Exit gap increase above (percentage points)"],
];
export function Workspace({
  view,
}: {
  view: "watchlist" | "alerts" | "dashboard";
}) {
  const ready = useHydrated();
  const account = useAccount();
  const live = !!account.data;
  const queryClient = useQueryClient();
  const state = useStore();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [showForm, setShowForm] = useState(false);
  const [mint, setMint] = useState(DEMO_MINT);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [position, setPosition] = useState("1000");
  const [kind, setKind] = useState("gap_above");
  const [threshold, setThreshold] = useState("15");
  const [email, setEmail] = useState(false);
  const [working, setWorking] = useState(false);
  const watchQuery = useQuery({
    queryKey: ["watchlist", account.data?.id],
    enabled: live,
    queryFn: () => apiFetch<WatchRow[]>("/api/v1/watchlist"),
  });
  const rulesQuery = useQuery({
    queryKey: ["alerts", account.data?.id],
    enabled: live,
    queryFn: () => apiFetch<RuleRow[]>("/api/v1/alerts"),
  });
  const historyQuery = useQuery({
    queryKey: ["history", account.data?.id],
    enabled: live,
    queryFn: () => apiFetch<{ analysis: Analysis }[]>("/api/v1/history"),
  });
  const eventsQuery = useQuery({
    queryKey: ["events", account.data?.id],
    enabled: live,
    queryFn: () =>
      apiFetch<{ id: string; message: string; created_at: string }[]>(
        "/api/v1/events",
      ),
  });
  const watch: WatchRow[] = live
    ? (watchQuery.data ?? [])
    : ready
      ? state.watch
      : [];
  const rules: RuleRow[] = live
    ? (rulesQuery.data ?? [])
    : ready
      ? state.alerts
      : [];
  const recent = live
    ? (historyQuery.data?.map((x) => x.analysis) ?? [])
    : ready
      ? state.recent
      : [];
  const displayed = watch
    .filter((w) =>
      `${w.name} ${w.symbol} ${w.mint}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "position"
        ? Number(b.position) - Number(a.position)
        : a.name.localeCompare(b.name),
    );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError("");
    try {
      if (view === "alerts") {
        const rule = alertSchema.parse({
          mint,
          kind,
          threshold: Number(threshold),
          email,
        });
        if (live)
          await apiFetch("/api/v1/alerts", {
            method: "POST",
            body: JSON.stringify(rule),
          });
        else
          state.addAlert({
            id: crypto.randomUUID(),
            mint: DEMO_MINT,
            kind,
            threshold: rule.threshold,
            enabled: true,
          });
      } else {
        const item = watchSchema.parse({
          mint,
          name,
          symbol,
          position,
          mode: "live",
        });
        if (live)
          await apiFetch("/api/v1/watchlist", {
            method: "POST",
            body: JSON.stringify(item),
          });
        else
          state.addWatch({
            id: "poor",
            mint: DEMO_MINT,
            name: name || "Example token",
            symbol: symbol || "EXAMPLE",
            position,
            scenario: "poor",
          });
      }
      await queryClient.invalidateQueries();
      setShowForm(false);
    } catch (e) {
      setError(
        e instanceof z.ZodError ? e.issues[0].message : (e as Error).message,
      );
    } finally {
      setWorking(false);
    }
  }
  async function remove(id: string, type: "watchlist" | "alerts") {
    try {
      if (live) await apiFetch(`/api/v1/${type}/${id}`, { method: "DELETE" });
      else if (type === "watchlist") state.removeWatch(id);
      else state.removeAlert(id);
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function editPosition(w: WatchRow) {
    const next = prompt("Displayed USD position size", w.position);
    if (!next) return;
    try {
      watchSchema.shape.position.parse(next);
      if (live)
        await apiFetch(`/api/v1/watchlist/${w.id}`, {
          method: "PATCH",
          body: JSON.stringify({ position: next }),
        });
      else
        state.addWatch({
          ...w,
          position: next,
          scenario: w.scenario ?? "poor",
        });
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const titles = {
    watchlist: [
      "Keep your exits in view.",
      "Save positions and revisit their market context.",
    ],
    alerts: [
      "The change is the signal.",
      "Set measurable thresholds for exit gaps, liquidity, source freshness, and route availability.",
    ],
    dashboard: [
      "Your market reality, at a glance.",
      "Recent scans, monitored positions, evidence, and alert activity in one workspace.",
    ],
  };
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title={titles[view][0]}
        description={titles[view][1]}
        action={
          <Button
            onClick={() => {
              if (!live) {
                setName("Example token");
                setSymbol("EXAMPLE");
              }
              setShowForm(!showForm);
            }}
          >
            <Plus size={14} />
            {view === "alerts" ? "New alert" : "Add token"}
          </Button>
        }
      />
      {!live && (
        <div className="notice demo-notice">
          <FlaskConical size={16} />
          <div>
            DEMO / BROWSER-LOCAL WORKSPACE. Local alerts are saved for
            exploration and are not monitored in the background.{" "}
            <Link href="/settings" className="inline-link">
              Sign in for persistent live monitoring
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
      {(error || watchQuery.error || rulesQuery.error) && (
        <p className="error-text" role="alert">
          {error || watchQuery.error?.message || rulesQuery.error?.message}
        </p>
      )}
      {showForm && (
        <div className="panel section-spacer" style={{ marginBottom: 22 }}>
          <div className="panel-heading">
            <h2>
              {view === "alerts" ? "Configure an alert" : "Save a position"}
            </h2>
            <span className="badge demo">
              {live ? "LIVE WORKSPACE" : "DEMO ONLY"}
            </span>
          </div>
          <form className="panel-body form-stack" onSubmit={save}>
            {live && (
              <label>
                Solana mint address
                <input
                  required
                  value={mint}
                  onChange={(e) => setMint(e.target.value)}
                />
              </label>
            )}
            {view === "alerts" ? (
              <>
                <label>
                  Trigger
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {kinds.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Threshold
                  <input
                    type="number"
                    min="0"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </label>
                {live && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={email}
                      onChange={(e) => setEmail(e.target.checked)}
                    />
                    Email notifications (requires configured delivery and
                    account opt-in)
                  </label>
                )}
                <p className="small-note">
                  Live monitoring targets 15-minute intervals, subject to
                  backlog and provider limits. A 60-minute cooldown prevents
                  repeat alerts. Change-based rules need two stored
                  observations.
                </p>
              </>
            ) : (
              <>
                <label>
                  Token name
                  <input
                    required
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Token symbol
                  <input
                    required
                    value={symbol}
                    maxLength={24}
                    onChange={(e) => setSymbol(e.target.value)}
                  />
                </label>
                <label>
                  Displayed USD position
                  <input
                    required
                    inputMode="decimal"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </label>
              </>
            )}
            <Button type="submit" disabled={working}>
              {working ? "Saving…" : "Save"}
            </Button>
          </form>
        </div>
      )}
      {view === "dashboard" && (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <span>SAVED POSITIONS</span>
              <strong>{watch.length}</strong>
              <small>
                {live
                  ? "Private Supabase records"
                  : "Browser-local demo records"}
              </small>
            </div>
            <div className="metric-card">
              <span>ACTIVE ALERT RULES</span>
              <strong>{rules.filter((r) => r.enabled).length}</strong>
              <small>
                {live
                  ? "Scheduled monitoring when configured"
                  : "Demo rules are not monitored"}
              </small>
            </div>
            <div className="metric-card">
              <span>RECENT SCANS</span>
              <strong>{recent.length}</strong>
              <small>Actual captured sessions, with mode labels</small>
            </div>
          </div>
          <div className="panel section-spacer">
            <div className="panel-heading">
              <h2>Recent scans</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => queryClient.invalidateQueries()}
              >
                <RefreshCw size={13} />
                Refresh
              </Button>
            </div>
            {recent.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>TOKEN / MODE</th>
                      <th>DISPLAYED</th>
                      <th>QUOTED EXIT</th>
                      <th>GAP</th>
                      <th>CAPTURED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((a, i) => (
                      <tr key={`${a.capturedAt}-${i}`}>
                        <td>
                          <Link
                            href={
                              a.mode === "demo"
                                ? `/scan?demo=${a.scenario ?? "poor"}`
                                : `/token/${a.token.mint}`
                            }
                          >
                            ${a.token.symbol}
                          </Link>
                          <small>{a.mode.toUpperCase()}</small>
                        </td>
                        <td>{money(a.values.displayedValue)}</td>
                        <td>{money(a.values.exitValue)}</td>
                        <td className="amber">
                          {a.values.gapPercent == null
                            ? "Unknown"
                            : `${Number(a.values.gapPercent).toFixed(2)}%`}
                        </td>
                        <td>{new Date(a.capturedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <LayoutDashboard size={32} />
                <p>
                  No scans yet. Start with a real mint or a labeled demo
                  scenario.
                </p>
                <Button asChild variant="outline">
                  <Link href="/scan?demo=poor">Scan a demo token</Link>
                </Button>
              </div>
            )}
          </div>
          <div className="panel section-spacer">
            <div className="panel-heading">
              <h2>Highest captured exit discrepancies</h2>
              <span className="badge neutral">HISTORICAL SNAPSHOTS</span>
            </div>
            {recent
              .filter((a) => a.values.gapPercent != null)
              .sort(
                (a, b) =>
                  Number(b.values.gapPercent) - Number(a.values.gapPercent),
              )
              .slice(0, 5)
              .map((a, i) => (
                <Link
                  key={i}
                  className="alert-item"
                  href={
                    a.mode === "demo"
                      ? `/scan?demo=${a.scenario}`
                      : `/token/${a.token.mint}`
                  }
                >
                  <strong>
                    ${a.token.symbol} · {a.mode.toUpperCase()}
                  </strong>
                  <span className="amber">
                    {Number(a.values.gapPercent).toFixed(2)}%
                  </span>
                </Link>
              ))}
            {!recent.length && (
              <p className="panel-body">No stored exit estimates yet.</p>
            )}
          </div>
          <div className="panel section-spacer">
            <div className="panel-heading">
              <h2>Historical estimated exit gaps</h2>
            </div>
            <GapHistory analyses={recent} />
          </div>
        </>
      )}
      {view !== "alerts" && (
        <div className="panel section-spacer">
          <div className="panel-heading">
            <h2>Watchlist</h2>
            <Link className="inline-link" href="/scan">
              Scan a token
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="panel-body toolbar" style={{ marginBottom: 0 }}>
            <input
              aria-label="Search watchlist"
              placeholder="Search name, symbol, or mint…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Sort watchlist"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Name A–Z</option>
              <option value="position">Largest position</option>
            </select>
          </div>
          {displayed.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>TOKEN</th>
                    <th>POSITION</th>
                    <th>DATA STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <strong>${w.symbol}</strong>
                        <small>
                          {w.name} · {shorten(w.mint)}
                        </small>
                      </td>
                      <td>
                        <button
                          className="inline-link"
                          onClick={() => editPosition(w)}
                        >
                          {money(w.position)} · Edit
                        </button>
                      </td>
                      <td>
                        {live
                          ? "Rescan for a current quote"
                          : "DEMO / SIMULATED"}
                      </td>
                      <td>
                        <div className="status-row">
                          <Link
                            className="inline-link"
                            href={
                              live
                                ? `/token/${w.mint}`
                                : `/scan?demo=${w.scenario ?? "poor"}`
                            }
                          >
                            Rescan
                            <ArrowRight size={11} />
                          </Link>
                          <button
                            aria-label={`Remove ${w.symbol}`}
                            onClick={() => remove(w.id, "watchlist")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Star size={32} />
              <h2>
                {search ? "No matching tokens." : "Your watchlist starts here."}
              </h2>
              <p>Save a token from the scanner or add a position above.</p>
            </div>
          )}
        </div>
      )}
      {(view === "alerts" || view === "dashboard") && (
        <div className="panel section-spacer">
          <div className="panel-heading">
            <h2>Alert rules</h2>
            <span className="badge neutral">{rules.length} RULES</span>
          </div>
          {rules.length ? (
            rules.map((r) => (
              <div className="alert-item" key={r.id}>
                <div>
                  <strong>
                    {kinds.find((k) => k[0] === r.kind)?.[1] ?? r.kind} ·{" "}
                    {r.threshold}
                  </strong>
                  <p>
                    {shorten(r.mint)} ·{" "}
                    {live
                      ? r.enabled
                        ? "Enabled"
                        : "Paused"
                      : "DEMO · not monitored"}
                  </p>
                </div>
                <div className="status-row">
                  {live && (
                    <button
                      className="inline-link"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/v1/alerts/${r.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ enabled: !r.enabled }),
                          });
                          await queryClient.invalidateQueries();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {r.enabled ? "Pause" : "Enable"}
                    </button>
                  )}
                  <button
                    aria-label="Delete alert"
                    onClick={() => remove(r.id, "alerts")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Bell size={32} />
              <h2>No alert rules yet.</h2>
              <p>
                Choose a token and define a measurable trigger. Provider
                failures are distinct from zero-valued market data.
              </p>
            </div>
          )}
        </div>
      )}
      {view === "dashboard" && (
        <>
          <div className="panel section-spacer">
            <div className="panel-heading">
              <h2>Recent receipts</h2>
              <Link href="/receipts" className="inline-link">
                View evidence explorer
                <ArrowRight size={12} />
              </Link>
            </div>
            {ready && state.receipts.length ? (
              state.receipts.slice(0, 5).map((r) => (
                <Link
                  key={r.content.id}
                  className="alert-item"
                  href={`/receipt/${r.content.id}`}
                >
                  <strong>
                    ${r.content.analysis.token.symbol} ·{" "}
                    {r.content.mode.toUpperCase()}
                  </strong>
                  <span className="data-timestamp">
                    {new Date(r.content.issuedAt).toLocaleString()}
                  </span>
                </Link>
              ))
            ) : (
              <p className="panel-body">No receipts in this browser yet.</p>
            )}
          </div>
          {live && (
            <div className="panel section-spacer">
              <div className="panel-heading">
                <h2>In-app notifications</h2>
              </div>
              {eventsQuery.data?.length ? (
                eventsQuery.data.map((e) => (
                  <div className="alert-item" key={e.id}>
                    <p>{e.message}</p>
                    <span className="data-timestamp">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="panel-body">No monitoring events recorded.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function Settings() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const profile = useQuery({
    queryKey: ["profile", account.data?.id],
    enabled: !!account.data,
    queryFn: () =>
      apiFetch<{ email_notifications: boolean }[]>("/api/v1/profile"),
  });
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      z.email().parse(email);
      const { error } = await browserAuth().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage("Check your email for a sign-in link.");
    } catch (e) {
      setMessage(
        e instanceof z.ZodError
          ? "Enter a valid email address."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="YOUR ACCOUNT"
        title="Your workspace. Your preferences."
        description="Sign in with an email link. No password, wallet connection, or trading permission required."
      />
      <div className="two-col">
        <div className="panel">
          <div className="panel-heading">
            <h2>{account.data ? "Account" : "Email sign-in"}</h2>
            <Mail size={17} />
          </div>
          <div className="panel-body">
            {!authConfigured ? (
              <>
                <div className="notice">
                  Email sign-in is not configured. Set the public Supabase URL
                  and anonymous key, apply migrations, and enable email
                  authentication.
                </div>
                <p>
                  The scanner and complete demo are available without an
                  account.
                </p>
                <Button asChild variant="outline" style={{ marginTop: 20 }}>
                  <Link href="/scan?demo=poor">Explore demo</Link>
                </Button>
              </>
            ) : account.data ? (
              <>
                <p>Signed in as {account.data.email}</p>
                <Button
                  variant="outline"
                  style={{ marginTop: 20 }}
                  onClick={async () => {
                    await browserAuth().auth.signOut();
                    queryClient.clear();
                    window.location.reload();
                  }}
                >
                  <LogOut size={14} />
                  Sign out
                </Button>
              </>
            ) : (
              <form className="form-stack" onSubmit={signIn}>
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send sign-in link"}
                  <ArrowRight size={14} />
                </Button>
              </form>
            )}
            {message && (
              <p role="status" className="small-note">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="stack">
          <div className="panel">
            <div className="panel-heading">
              <h2>Notification preferences</h2>
              <Bell size={17} />
            </div>
            <div className="panel-body">
              <p>
                Live alerts are available in your dashboard. Email delivery
                requires a configured Resend key, sender, an enabled alert, and
                your account opt-in.
              </p>
              {account.data && (
                <form
                  className="form-stack section-spacer"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await apiFetch("/api/v1/profile", {
                        method: "POST",
                        body: JSON.stringify({
                          email_notifications: notifications,
                        }),
                      });
                      await profile.refetch();
                      setMessage("Notification preferences saved.");
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  <p className="small-note">
                    Saved email preference:{" "}
                    {profile.data?.[0]?.email_notifications
                      ? "enabled"
                      : "disabled"}
                  </p>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                    />
                    Enable email notifications
                  </label>
                  <Button variant="outline">Save preferences</Button>
                </form>
              )}
            </div>
          </div>
          <div className="panel">
            <div className="panel-body">
              <ShieldCheck size={22} className="mint" />
              <h3 style={{ margin: "15px 0 10px" }}>Your keys stay yours.</h3>
              <p>
                CAPGAP does not request seed phrases, private keys, token
                approvals, or transaction signatures.
              </p>
              <Link className="inline-link section-spacer" href="/privacy">
                Read the privacy policy
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
