import { timingSafeEqual } from "node:crypto";
import { adminDatabase, recordAnalysis } from "./database";
import { ApiError } from "./api";
import { analyze } from "./engine";
import { scanSchema } from "./validation";
import { alertTriggered, dedupeKey } from "./alerts";
import type { Analysis } from "./models";
export async function monitor(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.MONITOR_SECRET ?? ""}`;
  if (
    !process.env.MONITOR_SECRET ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  )
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Monitoring authorization required.",
    );
  const db = adminDatabase();
  const { data: jobs, error } = await db.rpc("claim_monitoring_jobs", {
    batch_size: 3,
  });
  if (error) throw new Error("Monitoring schema is unavailable.");
  const outcomes = [];
  for (const job of jobs ?? []) {
    const start = Date.now();
    try {
      const analysis = await analyze(
        scanSchema.parse({
          mint: job.mint,
          amount: job.position,
          mode: "live",
        }),
      );
      await recordAnalysis(analysis, job.user_id);
      const { data: rules } = await db
        .from("alert_rules")
        .select("*")
        .eq("user_id", job.user_id)
        .eq("mint", job.mint)
        .eq("enabled", true);
      const { data: prior } = await db
        .from("monitoring_runs")
        .select("analysis")
        .eq("job_id", job.id)
        .eq("status", "ok")
        .order("created_at", { ascending: false })
        .limit(1);
      for (const rule of rules ?? []) {
        if (
          !alertTriggered(
            rule,
            analysis,
            prior?.[0]?.analysis as Analysis | undefined,
          )
        )
          continue;
        const since = new Date(
          Date.now() - rule.cooldown_minutes * 60000,
        ).toISOString();
        const { data: recent } = await db
          .from("alert_events")
          .select("id")
          .eq("rule_id", rule.id)
          .gte("created_at", since)
          .limit(1);
        if (recent?.length) continue;
        const { data: event, error: insertError } = await db
          .from("alert_events")
          .insert({
            user_id: rule.user_id,
            rule_id: rule.id,
            dedupe_key: dedupeKey(rule.id, Date.now(), rule.cooldown_minutes),
            message: `${rule.kind}: ${analysis.token.symbol}; status ${analysis.diagnostic.status}`,
            analysis,
          })
          .select("id")
          .single();
        if (
          !insertError &&
          event &&
          rule.email &&
          process.env.RESEND_API_KEY &&
          process.env.EMAIL_FROM
        ) {
          const { data: profile } = await db
            .from("profiles")
            .select("email_notifications")
            .eq("id", rule.user_id)
            .single();
          if (profile?.email_notifications) {
            const { data: account } = await db.auth.admin.getUserById(
              rule.user_id,
            );
            if (account.user?.email) {
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                  "Idempotency-Key": event.id,
                },
                body: JSON.stringify({
                  from: process.env.EMAIL_FROM,
                  to: account.user.email,
                  subject: "CAPGAP monitoring alert",
                  text: `${rule.kind} triggered for ${job.mint}. ${analysis.diagnostic.reasons.join(" ")} Quoted proceeds are estimates.`,
                }),
                signal: AbortSignal.timeout(8000),
              });
              await db
                .from("alert_events")
                .update({ email_status: response.ok ? "sent" : "failed" })
                .eq("id", event.id);
            }
          }
        }
      }
      await db.from("monitoring_runs").insert({
        job_id: job.id,
        status: "ok",
        analysis,
        duration_ms: Date.now() - start,
      });
      await db
        .from("monitoring_jobs")
        .update({
          locked_until: null,
          last_run_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + 15 * 60000).toISOString(),
        })
        .eq("id", job.id);
      outcomes.push({ id: job.id, status: "ok" });
    } catch {
      await db.from("monitoring_runs").insert({
        job_id: job.id,
        status: "failed",
        duration_ms: Date.now() - start,
        error: "Provider or storage failure.",
      });
      await db
        .from("monitoring_jobs")
        .update({
          locked_until: null,
          next_run_at: new Date(Date.now() + 30 * 60000).toISOString(),
        })
        .eq("id", job.id);
      outcomes.push({ id: job.id, status: "failed" });
    }
  }
  return { processed: outcomes.length, outcomes };
}
