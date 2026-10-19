"use client";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analysis } from "@/lib/models";
import { shorten } from "@/lib/utils";
export default function GapHistory({ analyses }: { analyses: Analysis[] }) {
  const [selected, setSelected] = useState("");
  const groups = new Map<string, Analysis[]>();
  for (const a of analyses) {
    if (a.values.gapPercent == null) continue;
    const key = JSON.stringify([
      a.mode,
      a.scenario ?? null,
      a.token.mint,
      a.pool,
      a.values.quantity,
      a.values.conversionBasis.startsWith("SIMULATED")
        ? "simulated"
        : a.values.usdcUsd,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const key = groups.has(selected) ? selected : groups.keys().next().value;
  const rows = key ? (groups.get(key) ?? []) : [];
  const points = [
    ...new Map(rows.map((a) => [a.quote.collectedAt, a])).values(),
  ]
    .sort((a, b) => a.quote.collectedAt.localeCompare(b.quote.collectedAt))
    .map((a) => ({
      time: new Date(a.quote.collectedAt).toLocaleString(),
      gap: Number(a.values.gapPercent),
    }));
  return (
    <>
      <div className="panel-body">
        <p className="small-note">
          Actual captured scans grouped by mode, mint, pool, exact token
          quantity, and USD conversion context. No interpolation across
          positions; repeated cached quotes are deduplicated.
        </p>
        {groups.size > 0 && (
          <select
            aria-label="Historical position"
            className="full-width section-spacer"
            value={key ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {[...groups].map(([k, v]) => (
              <option key={k} value={k}>
                ${v[0].token.symbol} · {v[0].mode.toUpperCase()} ·{" "}
                {v[0].values.quantity} tokens · pool{" "}
                {shorten(v[0].pool ?? "unknown")}
              </option>
            ))}
          </select>
        )}
      </div>
      {points.length > 1 ? (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={points}>
              <CartesianGrid stroke="#232a34" strokeDasharray="3 5" />
              <XAxis dataKey="time" stroke="#8d98a8" fontSize={9} />
              <YAxis stroke="#8d98a8" fontSize={10} unit="%" />
              <Tooltip
                contentStyle={{
                  background: "#10151d",
                  border: "1px solid #303a47",
                }}
              />
              <Line
                dataKey="gap"
                name="Historical quoted gap (%)"
                stroke="#b5ff39"
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="panel-body small-note">
          Collecting data. Insufficient sample size for this exact position.
        </p>
      )}
    </>
  );
}
