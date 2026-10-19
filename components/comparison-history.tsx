"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { apiFetch } from "./token/analysis";
const History = dynamic(() => import("./charts/history"), { ssr: false });
export function ComparisonHistory({
  mint,
  pool,
}: {
  mint: string;
  pool: string | null;
}) {
  const query = useQuery({
    queryKey: ["comparison-history", mint, pool],
    queryFn: () =>
      apiFetch<{ observed_at: string; deviation: string }[]>(
        `/api/v1/token/${mint}/history${pool ? `?pool=${encodeURIComponent(pool)}` : ""}`,
      ),
  });
  return (
    <div className="panel section-spacer">
      <div className="panel-heading">
        <h2>Stored same-pool divergence</h2>
      </div>
      {(query.data?.length ?? 0) > 1 ? (
        <History observations={query.data!} />
      ) : (
        <p className="panel-body small-note">
          {query.error
            ? query.error.message
            : "Collecting data. Insufficient aligned observations. Source observation times are required; retrieval timestamps are not substituted."}
        </p>
      )}
    </div>
  );
}
