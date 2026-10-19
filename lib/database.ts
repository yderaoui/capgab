import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Analysis, Receipt } from "./models";
export const databaseConfigured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
export async function userDatabase() {
  if (!databaseConfigured()) return null;
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (entries) => {
          try {
            entries.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server component cannot update cookies. */
          }
        },
      },
    },
  );
}
export function adminDatabase() {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    throw new Error("Persistent storage is not configured.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function currentUser() {
  const db = await userDatabase();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user;
}
const demoReceipts = new Map<string, Receipt>();
export async function storeReceipt(receipt: Receipt) {
  if (receipt.content.mode === "demo") {
    if (demoReceipts.size > 200)
      demoReceipts.delete(demoReceipts.keys().next().value!);
    demoReceipts.set(receipt.content.id, receipt);
    return;
  }
  const db = adminDatabase();
  const user = await currentUser();
  const { error: keyError } = await db
    .from("receipt_signing_keys")
    .upsert(
      { id: receipt.keyId, public_key: receipt.publicKey },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (keyError) throw keyError;
  const { data: registeredKey, error: registeredError } = await db
    .from("receipt_signing_keys")
    .select("public_key")
    .eq("id", receipt.keyId)
    .single();
  if (registeredError || registeredKey?.public_key !== receipt.publicKey)
    throw new Error(
      "Signing key ID does not match its immutable registered public key. Rotate to a new key ID.",
    );
  const { error } = await db.from("evidence_receipts").insert({
    id: receipt.content.id,
    user_id: user?.id,
    mode: "live",
    key_id: receipt.keyId,
    receipt,
    hash: receipt.hash,
  });
  if (error) throw error;
}
export async function readReceipt(id: string): Promise<Receipt | null> {
  if (demoReceipts.has(id)) return demoReceipts.get(id)!;
  if (!databaseConfigured()) return null;
  const db = await userDatabase();
  const { data } = await db!
    .from("evidence_receipts")
    .select("receipt")
    .eq("id", id)
    .single();
  return data?.receipt ?? null;
}
export async function publicReceipts() {
  if (!databaseConfigured()) return [];
  const db = await userDatabase();
  const { data } = await db!
    .from("evidence_receipts")
    .select("id,created_at,receipt")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
export async function recordAnalysis(analysis: Analysis, userId?: string) {
  if (analysis.mode === "demo" || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return;
  const db = adminDatabase();
  // Register identity separately from observation history; quantities stay exact strings.
  const { error: tokenError } = await db
    .from("tokens")
    .upsert(
      {
        chain: "solana",
        mint: analysis.token.mint,
        name: analysis.token.name,
        symbol: analysis.token.symbol,
        decimals: analysis.token.decimals,
        program: analysis.token.program,
      },
      { onConflict: "chain,mint" },
    );
  if (tokenError) throw tokenError;
  const distinctPools = [
    ...new Map(
      analysis.providers
        .flatMap((p) => p.snapshots)
        .map((s) => [
          s.pool,
          {
            chain: "solana",
            address: s.pool,
            mint: s.mint,
            quote_mint: s.quoteMint,
            dex: s.dex,
          },
        ]),
    ).values(),
  ];
  if (distinctPools.length) {
    const { error } = await db
      .from("pools")
      .upsert(distinctPools, { onConflict: "chain,address" });
    if (error) throw error;
  }
  if (analysis.quote.status === "AVAILABLE") {
    const { error } = await db
      .from("exit_quotes")
      .upsert(
        {
          mint: analysis.token.mint,
          in_amount: analysis.quote.inAmount,
          out_amount: analysis.quote.outAmount,
          output_mint: analysis.quote.outputMint,
          mode: "live",
          payload: analysis.quote,
          collected_at: analysis.quote.collectedAt,
        },
        { onConflict: "mint,in_amount,collected_at", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
  const { error } = await db.from("scans").insert({
    user_id: userId ?? null,
    mint: analysis.token.mint,
    mode: "live",
    analysis,
  });
  if (error) throw error;
  const rows = analysis.providers.map((p) => ({
    mint: analysis.token.mint,
    provider: p.source,
    mode: "live",
    success: p.status !== "UNAVAILABLE",
    latency_ms: p.latencyMs,
    retrieved_at: p.snapshots[0]?.retrievedAt ?? analysis.capturedAt,
    observed_at: p.snapshots[0]?.observedAt ?? null,
    payload: p,
  }));
  const { error: snapshotError } = await db
    .from("provider_snapshots")
    .upsert(rows, {
      onConflict: "provider,mint,retrieved_at",
      ignoreDuplicates: true,
    });
  if (snapshotError) throw snapshotError;
  if (analysis.comparison.comparable) {
    const { error: e } = await db.from("comparison_observations").insert({
      mint: analysis.token.mint,
      pool: analysis.pool,
      deviation: analysis.comparison.deviation,
      mode: "live",
      observed_at: analysis.capturedAt,
    });
    if (e) throw e;
  }
}
