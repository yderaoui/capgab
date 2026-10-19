"use client";
import { useQuery } from "@tanstack/react-query";
import { ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { PageHeading } from "./layout/shell";
import { apiFetch } from "./token/analysis";
import { Button } from "./ui/button";
import dynamic from "next/dynamic";
const History = dynamic(() => import("./charts/history"), { ssr: false });
interface Reliability {
  provider: string;
  sample_count: number;
  success_percent: number;
  missing_percent: number;
  median_latency_ms: number;
  source_time_unknown_percent: number;
  first_collected: string;
  last_collected: string;
  comparable_count: number;
  median_deviation: string | null;
  p95_deviation: string | null;
}
export function Analytics() {
  const query = useQuery({
    queryKey: ["reliability"],
    queryFn: () =>
      apiFetch<{
        rows: Reliability[];
        observations: { observed_at: string; deviation: string }[];
        message: string | null;
      }>("/api/v1/analytics/reliability"),
  });
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="OBSERVATION, NOT A VERDICT"
        title="How consistently do sources agree?"
        description="Provider coverage, retrieval success, and same-pool agreement from actual stored live observations. Agreement does not establish price accuracy."
        action={
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw size={14} />
            Refresh
          </Button>
        }
      />
      <div className="notice">
        No provider is ranked as objectively accurate. We do not have an
        independent price ground truth. Missing observation times prevent direct
        price comparisons.
      </div>
      {query.error && <p className="error-text">{query.error.message}</p>}
      <div className="panel">
        <div className="panel-heading">
          <h2>Provider observations</h2>
          <span className="badge neutral">LIVE DATA ONLY</span>
        </div>
        {query.data?.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PROVIDER</th>
                  <th>SAMPLES</th>
                  <th>RETRIEVAL SUCCESS</th>
                  <th>MISSING DATA</th>
                  <th>MEDIAN LATENCY</th>
                  <th>UNKNOWN SOURCE TIME</th>
                  <th>COMPARABLE</th>
                  <th>MEDIAN / P95 DEVIATION</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((r) => (
                  <tr key={r.provider}>
                    <td>
                      {r.provider}
                      <small>
                        {new Date(r.first_collected).toLocaleDateString()} –{" "}
                        {new Date(r.last_collected).toLocaleDateString()}
                      </small>
                    </td>
                    <td>{r.sample_count}</td>
                    <td>{Number(r.success_percent).toFixed(1)}%</td>
                    <td>{Number(r.missing_percent).toFixed(1)}%</td>
                    <td>{Math.round(r.median_latency_ms)}ms</td>
                    <td>{Number(r.source_time_unknown_percent).toFixed(1)}%</td>
                    <td>{r.comparable_count}</td>
                    <td>
                      {r.median_deviation ?? "Unknown"} /{" "}
                      {r.p95_deviation ?? "Unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <ChartNoAxesCombined size={38} />
            <h2>Collecting data. Insufficient sample size.</h2>
            <p>
              No historical readings are manufactured. Configure persistent
              storage and collect live scans to begin measuring retrieval
              coverage.
            </p>
          </div>
        )}
      </div>
      {(query.data?.observations.length ?? 0) > 1 && (
        <div className="panel section-spacer">
          <div className="panel-heading">
            <h2>Stored same-pool divergence</h2>
          </div>
          <History observations={query.data!.observations} />
        </div>
      )}
      <div className="panel section-spacer">
        <div className="panel-body">
          <h3>Read the sample, not just the number.</h3>
          <p className="small-note">
            This dataset contains only tokens that CAPGAP users or monitoring
            jobs scanned. Selection bias, repeated cached retrievals, provider
            coverage, source-time omissions, and pool matching constrain any
            conclusion. Latency measures this deployment’s request time; a cache
            hit is not upstream latency. Fewer than 10 retrieval samples per
            source are withheld. Source freshness cannot be measured without an
            independent timestamped reference. Retention: 90 days for raw scans
            and observations; receipts are retained.
          </p>
        </div>
      </div>
    </div>
  );
}
