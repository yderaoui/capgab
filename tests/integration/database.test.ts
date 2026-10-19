import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,aud text,role text,email text);create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid to anon,authenticated;`,
  );
  const sql = readFileSync(
    "supabase/migrations/202610190001_capgap.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("executes the migration and actual owner-isolation assertions", async () => {
  const sql = readFileSync("supabase/tests/rls.sql", "utf8");
  await expect(db.exec(sql)).resolves.toBeDefined();
});
it("enforces immutable receipts and signing keys and rejects demo contamination", async () => {
  await db.query(
    `insert into receipt_signing_keys(id,public_key) values('test-key','public-test')`,
  );
  await expect(
    db.query(
      `update receipt_signing_keys set public_key='changed' where id='test-key'`,
    ),
  ).rejects.toThrow("immutable");
  await expect(
    db.query(
      `insert into evidence_receipts(id,key_id,receipt,hash,mode) values(gen_random_uuid(),'test-key','{"content":{"mode":"demo"}}',repeat('a',64),'live')`,
    ),
  ).rejects.toThrow();
  await db.query(
    `insert into evidence_receipts(id,key_id,receipt,hash) values('00000000-0000-4000-8000-000000000099','test-key','{"content":{"mode":"live"}}',repeat('a',64))`,
  );
  await expect(
    db.query(
      `delete from evidence_receipts where id='00000000-0000-4000-8000-000000000099'`,
    ),
  ).rejects.toThrow("immutable");
  await expect(
    db.query(
      `insert into scans(mint,mode,analysis) values('mint','live','{"mode":"demo"}')`,
    ),
  ).rejects.toThrow();
});
it("applies atomic request limits and denies public quota mutation", async () => {
  const a = await db.query<{ allowed: boolean }>(
    `select consume_rate_limit('sample',1,60) allowed`,
  );
  expect(a.rows[0].allowed).toBe(true);
  const b = await db.query<{ allowed: boolean }>(
    `select consume_rate_limit('sample',1,60) allowed`,
  );
  expect(b.rows[0].allowed).toBe(false);
  await db.exec("set role anon");
  await expect(
    db.query(`select consume_rate_limit('other',99999,1)`),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role");
});
it("creates monitoring jobs from rules and leases jobs idempotently", async () => {
  await db.exec(
    `insert into auth.users(id) values('00000000-0000-4000-8000-000000000003');insert into alert_rules(user_id,mint,kind,threshold) values('00000000-0000-4000-8000-000000000003','mint3','gap_above',15)`,
  );
  expect((await db.query("select * from monitoring_jobs")).rows).toHaveLength(
    1,
  );
  expect(
    (await db.query("select * from claim_monitoring_jobs(3)")).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select * from claim_monitoring_jobs(3)")).rows,
  ).toHaveLength(0);
  await db.exec(`update alert_rules set enabled=false where mint='mint3'`);
  expect((await db.query("select * from monitoring_jobs")).rows).toHaveLength(
    0,
  );
});
it("withholds provider analytics below minimum samples", async () => {
  expect((await db.query("select * from reliability_summary()")).rows).toEqual(
    [],
  );
});
it("detaches a deleted account without changing signed receipt content", async () => {
  await db.exec(
    `insert into auth.users(id) values('00000000-0000-4000-8000-000000000004');insert into evidence_receipts(id,user_id,key_id,receipt,hash) values('00000000-0000-4000-8000-000000000088','00000000-0000-4000-8000-000000000004','test-key','{"content":{"mode":"live"}}',repeat('b',64));delete from auth.users where id='00000000-0000-4000-8000-000000000004'`,
  );
  const row = await db.query<{
    user_id: string | null;
    receipt: { content: { mode: string } };
  }>(
    `select user_id,receipt from evidence_receipts where id='00000000-0000-4000-8000-000000000088'`,
  );
  expect(row.rows[0].user_id).toBeNull();
  expect(row.rows[0].receipt.content.mode).toBe("live");
});
