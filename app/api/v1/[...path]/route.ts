import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  ApiError,
  assertOrigin,
  bodyJson,
  rateLimit,
} from "@/lib/api";
import { analyze } from "@/lib/engine";
import { alertSchema, scanSchema, watchSchema } from "@/lib/validation";
import {
  currentUser,
  databaseConfigured,
  publicReceipts,
  readReceipt,
  recordAnalysis,
  storeReceipt,
  userDatabase,
} from "@/lib/database";
import { issueReceipt, verifyReceipt } from "@/lib/receipts";
import { mintSchema } from "@/lib/solana";
import { monitor } from "@/lib/monitor";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;
    const method = request.method;
    if (method !== "GET") assertOrigin(request);
    if (resource === "health" && method === "GET")
      return NextResponse.json({
        status: "ok",
        database: databaseConfigured(),
        quotes: "Jupiter Swap V2 /order; no taker",
        methodology: "1.0.0",
      });
    if (resource === "monitor" && method === "POST")
      return NextResponse.json(await monitor(request));
    if (resource === "keys" && id && method === "GET") {
      if (!databaseConfigured())
        throw new ApiError(
          503,
          "NOT_CONFIGURED",
          "Public signing key registry requires Supabase.",
        );
      const db = await userDatabase();
      const { data } = await db!
        .from("receipt_signing_keys")
        .select("id,public_key,created_at")
        .eq("id", id)
        .single();
      if (!data) throw new ApiError(404, "NOT_FOUND", "Key not found.");
      return NextResponse.json(data);
    }
    if (
      ["scan", "quote", "exit-analysis"].includes(resource) &&
      method === "POST"
    ) {
      const input = scanSchema.parse(await bodyJson(request));
      if (input.mode !== "demo") await rateLimit(request);
      else await rateLimit(request, "demo-scan", 120, 60, true);
      const result = await analyze(input);
      const user = await currentUser();
      try {
        await recordAnalysis(result, user?.id);
      } catch {
        result.limitations.push(
          "Observation persistence failed. This result is not included in stored analytics.",
        );
      }
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (resource === "token" && id && method === "GET") {
      mintSchema.parse(id);
      if (action === "history") {
        if (!databaseConfigured()) return NextResponse.json([]);
        const db = await userDatabase();
        const requestedPool = new URL(request.url).searchParams.get("pool");
        let query = db!
          .from("comparison_observations")
          .select("pool,deviation,observed_at")
          .eq("mint", id)
          .eq("mode", "live")
          .order("observed_at", { ascending: false })
          .limit(100);
        if (requestedPool)
          query = query.eq("pool", mintSchema.parse(requestedPool));
        const { data, error } = await query;
        if (error)
          throw new ApiError(
            503,
            "DATABASE_ERROR",
            "Stored comparisons are unavailable.",
          );
        return NextResponse.json(data ?? []);
      }
      await rateLimit(request);
      const result = await analyze(scanSchema.parse({ mint: id }));
      return NextResponse.json(
        action === "pools"
          ? result.providers.flatMap((p) => p.snapshots)
          : action === "compare"
            ? result.comparison
            : result,
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (resource === "receipts") {
      if (method === "GET" && id) {
        const receipt = await readReceipt(z.uuid().parse(id));
        if (!receipt)
          throw new ApiError(
            404,
            "NOT_FOUND",
            "Receipt not found. Demo previews expire when the server restarts.",
          );
        if (action === "verify") {
          let trustedKey: string | undefined;
          if (receipt.content.mode === "live" && databaseConfigured()) {
            const db = await userDatabase();
            const { data } = await db!
              .from("receipt_signing_keys")
              .select("public_key")
              .eq("id", receipt.keyId)
              .single();
            trustedKey = data?.public_key;
          }
          return NextResponse.json(verifyReceipt(receipt, trustedKey));
        }
        return NextResponse.json(receipt);
      }
      if (method === "GET") return NextResponse.json(await publicReceipts());
      if (method === "POST") {
        const input = scanSchema.parse(await bodyJson(request));
        if (input.mode === "demo")
          await rateLimit(request, "demo-receipt", 10, 60, true);
        if (input.mode === "live") {
          await rateLimit(request, "receipt", 5);
          if (!(await currentUser()))
            throw new ApiError(
              401,
              "UNAUTHENTICATED",
              "Sign in to issue a persistent live receipt.",
            );
          if (
            !process.env.RECEIPT_SIGNING_PRIVATE_KEY ||
            !process.env.SUPABASE_SERVICE_ROLE_KEY
          )
            throw new ApiError(
              503,
              "NOT_CONFIGURED",
              "Persistent storage and a signing key are required for live receipts.",
            );
        }
        // Recollect inputs on the server; never sign client-supplied prices or quote results.
        const receipt = issueReceipt(await analyze(input));
        await storeReceipt(receipt);
        return NextResponse.json(receipt, { status: 201 });
      }
    }
    if (resource === "analytics" && id === "reliability") {
      if (!databaseConfigured())
        return NextResponse.json({
          rows: [],
          observations: [],
          message: "Collecting data. Insufficient sample size.",
        });
      const db = await userDatabase();
      const { data, error } = await db!.rpc("reliability_summary");
      if (error)
        throw new ApiError(
          503,
          "DATABASE_ERROR",
          "Reliability aggregation is unavailable. Apply migrations.",
        );
      const { data: observations } = await db!
        .from("comparison_observations")
        .select("deviation,observed_at")
        .eq("mode", "live")
        .order("observed_at", { ascending: false })
        .limit(100);
      return NextResponse.json({
        rows: data ?? [],
        observations: observations ?? [],
        message: !data?.length
          ? "Collecting data. Insufficient sample size."
          : null,
      });
    }
    if (
      ["watchlist", "alerts", "profile", "history", "events"].includes(resource)
    ) {
      const db = await userDatabase();
      const user = await currentUser();
      if (!db || !user)
        throw new ApiError(
          401,
          "UNAUTHENTICATED",
          "Sign in with email to access private records.",
        );
      const table =
        resource === "watchlist"
          ? "watchlist_items"
          : resource === "alerts"
            ? "alert_rules"
            : resource === "profile"
              ? "profiles"
              : resource === "events"
                ? "alert_events"
                : "scans";
      if (method === "GET") {
        const { data, error } = await db
          .from(table)
          .select("*")
          .eq(resource === "profile" ? "id" : "user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error)
          throw new ApiError(
            503,
            "DATABASE_ERROR",
            "Unable to read records. Apply Supabase migrations.",
          );
        return NextResponse.json(data);
      }
      if (method === "POST") {
        await rateLimit(request, `user-${user.id}`, 30);
        const raw = await bodyJson(request);
        const payload =
          resource === "watchlist"
            ? watchSchema.parse(raw)
            : resource === "alerts"
              ? alertSchema.parse(raw)
              : resource === "profile"
                ? z
                    .object({ email_notifications: z.boolean() })
                    .strict()
                    .parse(raw)
                : null;
        if (!payload)
          throw new ApiError(
            405,
            "METHOD_NOT_ALLOWED",
            "This collection is read-only.",
          );
        if (
          resource === "watchlist" &&
          "mode" in payload &&
          payload.mode === "demo"
        )
          throw new ApiError(
            400,
            "DEMO_SEPARATION",
            "Demo items are stored locally, not in production watchlists.",
          );
        const query =
          resource === "profile"
            ? db.from(table).upsert({ ...payload, id: user.id })
            : db.from(table).insert({ ...payload, user_id: user.id });
        const { data, error } = await query.select().single();
        if (error)
          throw new ApiError(
            409,
            "DATABASE_ERROR",
            "Unable to save. Check duplicates and schema configuration.",
          );
        return NextResponse.json(data, { status: 201 });
      }
      if (
        id &&
        ["PATCH", "DELETE"].includes(method) &&
        ["watchlist", "alerts"].includes(resource)
      ) {
        const recordId = z.uuid().parse(id);
        let query;
        if (method === "DELETE")
          query = db
            .from(table)
            .delete()
            .eq("id", recordId)
            .eq("user_id", user.id);
        else {
          const raw = await bodyJson(request);
          const parsedUpdate =
            resource === "watchlist"
              ? watchSchema.partial().parse(raw)
              : alertSchema.partial().parse(raw);
          const keys = raw && typeof raw === "object" ? Object.keys(raw) : [];
          const update = Object.fromEntries(
            Object.entries(parsedUpdate).filter(([key]) => keys.includes(key)),
          );
          query = db
            .from(table)
            .update(update)
            .eq("id", recordId)
            .eq("user_id", user.id);
        }
        const { data, error } = await query.select();
        if (error)
          throw new ApiError(409, "DATABASE_ERROR", "Unable to update record.");
        if (!data?.length)
          throw new ApiError(404, "NOT_FOUND", "Record not found.");
        return NextResponse.json(data);
      }
    }
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Unknown API endpoint or unsupported method.",
    );
  } catch (error) {
    return apiError(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
