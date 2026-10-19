import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createHash } from "node:crypto";
import { adminDatabase } from "./database";
import { ApiError } from "./errors";
export { ApiError } from "./errors";
const limits = new Map<string, { n: number; until: number }>();
export async function rateLimit(
  request: Request,
  bucket = "scan",
  max = 15,
  seconds = 60,
  localOnly = false,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = createHash("sha256").update(`${bucket}:${ip}`).digest("hex");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && !localOnly) {
    const { data, error } = await adminDatabase().rpc("consume_rate_limit", {
      bucket_key: key,
      max_requests: max,
      window_seconds: seconds,
    });
    if (error)
      throw new ApiError(
        503,
        "RATE_LIMIT_BACKEND",
        "Request limiting is temporarily unavailable.",
      );
    if (!data)
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Request limit reached. Pause for one minute.",
      );
    return;
  }
  if (
    process.env.NODE_ENV === "production" &&
    !localOnly &&
    process.env.ALLOW_MEMORY_RATE_LIMIT !== "true"
  )
    throw new ApiError(
      503,
      "RATE_LIMIT_CONFIG",
      "Configure Supabase for shared production rate limits, or explicitly enable single-instance memory limits.",
    );
  const now = Date.now();
  const entry = limits.get(key);
  if (entry && entry.until > now) {
    if (entry.n >= max)
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Request limit reached. Pause for one minute.",
      );
    entry.n++;
  } else {
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    limits.set(key, { n: 1, until: now + seconds * 1000 });
  }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  if (origin && origin !== new URL(allowed).origin)
    throw new ApiError(
      403,
      "ORIGIN_REJECTED",
      "Cross-origin mutation rejected.",
    );
}
export async function bodyJson(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 12000)
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 12 KB.");
  const text = await request.text();
  if (text.length > 12000)
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 12 KB.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be JSON.");
  }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues.map((i) => i.message).join(" "),
        },
      },
      { status: 400 },
    );
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: error.status === 429 ? { "Retry-After": "60" } : undefined,
      },
    );
  console.error(
    "CAPGAP request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    {
      error: {
        code: "REQUEST_FAILED",
        message:
          "Unable to complete this request. Check configuration or retry.",
      },
    },
    { status: 500 },
  );
}
