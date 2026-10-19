-- CAPGAP v1. Live storage rejects simulated observations at the database boundary.
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users on delete cascade,email_notifications boolean not null default false,created_at timestamptz not null default now());
create table public.tokens(id uuid primary key default gen_random_uuid(),chain text not null default 'solana' check(chain='solana'),mint text not null,name text,symbol text,decimals integer check(decimals between 0 and 255),program text,created_at timestamptz not null default now(),unique(chain,mint));
create table public.pools(id uuid primary key default gen_random_uuid(),chain text not null default 'solana',address text not null,mint text not null,quote_mint text not null,dex text,created_at timestamptz not null default now(),unique(chain,address));
create table public.provider_snapshots(id uuid primary key default gen_random_uuid(),mint text not null,provider text not null check(provider in ('dexscreener','geckoterminal')),mode text not null default 'live' check(mode='live'),success boolean not null,latency_ms integer not null,retrieved_at timestamptz not null,observed_at timestamptz,payload jsonb not null,created_at timestamptz not null default now());
create index snapshots_token_time on public.provider_snapshots(mint,created_at desc);
create index snapshots_provider_time on public.provider_snapshots(provider,created_at desc);
create unique index snapshots_retrieval_unique on public.provider_snapshots(provider,mint,retrieved_at);
create table public.comparison_observations(id uuid primary key default gen_random_uuid(),mint text not null,pool text not null,mode text not null default 'live' check(mode='live'),deviation numeric(100,40) not null,observed_at timestamptz not null,created_at timestamptz not null default now());
create index comparison_time on public.comparison_observations(observed_at desc);
create table public.exit_quotes(id uuid primary key default gen_random_uuid(),mint text not null,in_amount numeric(78,0) not null,out_amount numeric(78,0),output_mint text not null,mode text not null default 'live' check(mode='live'),payload jsonb not null,collected_at timestamptz not null,created_at timestamptz not null default now());
create unique index quote_retrieval_unique on public.exit_quotes(mint,in_amount,collected_at);
create table public.scans(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade,mint text not null,mode text not null default 'live' check(mode='live'),analysis jsonb not null check(analysis->>'mode'='live'),created_at timestamptz not null default now());
create index scans_owner_time on public.scans(user_id,created_at desc);
create table public.watchlists(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,name text not null default 'My watchlist',created_at timestamptz not null default now());
create table public.watchlist_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,mint text not null,name text not null,symbol text not null,pool text,position text not null default '1000' check(position ~ '^\d+(\.\d+)?$'),mode text not null default 'live' check(mode='live'),preferred_output text not null default 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' check(preferred_output='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),created_at timestamptz not null default now(),unique(user_id,mint));
create table public.alert_rules(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,mint text not null,kind text not null check(kind in ('gap_above','liquidity_below','quote_unavailable','provider_deviation','stale','liquidity_drop','gap_increase')),threshold numeric not null check(threshold>=0),enabled boolean not null default true,cooldown_minutes integer not null default 60 check(cooldown_minutes between 15 and 10080),position text not null default '1000',email boolean not null default false,created_at timestamptz not null default now());
create index alert_owner_mint on public.alert_rules(user_id,mint) where enabled;
create table public.alert_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,rule_id uuid references public.alert_rules on delete set null,dedupe_key text not null unique,message text not null,analysis jsonb not null,email_status text not null default 'not_requested',created_at timestamptz not null default now());
create index events_rule_time on public.alert_events(rule_id,created_at desc);
create table public.receipt_signing_keys(id text primary key,public_key text not null,created_at timestamptz not null default now());
create table public.evidence_receipts(id uuid primary key,user_id uuid references auth.users on delete set null,mode text not null default 'live' check(mode='live'),key_id text not null references public.receipt_signing_keys(id),receipt jsonb not null check(receipt->'content'->>'mode'='live'),hash text not null check(length(hash)=64),created_at timestamptz not null default now());
create index receipt_time on public.evidence_receipts(created_at desc);
create table public.monitoring_jobs(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,mint text not null,position text not null default '1000',next_run_at timestamptz not null default now(),last_run_at timestamptz,locked_until timestamptz,created_at timestamptz not null default now(),unique(user_id,mint));
create index monitoring_due on public.monitoring_jobs(next_run_at,locked_until);
create table public.monitoring_runs(id uuid primary key default gen_random_uuid(),job_id uuid not null references public.monitoring_jobs on delete cascade,status text not null check(status in ('ok','failed')),analysis jsonb,duration_ms integer,error text,created_at timestamptz not null default now());
create index runs_job_time on public.monitoring_runs(job_id,created_at desc);
create table public.rate_limit_buckets(bucket_key text primary key,requests integer not null,expires_at timestamptz not null);
-- Immutable rows, including for service-role application writes. Operators retain database ownership.
create function public.reject_receipt_mutation() returns trigger language plpgsql set search_path='' as $$ begin
if TG_TABLE_NAME='evidence_receipts' and TG_OP='UPDATE' then
if new.user_id is null and (to_jsonb(new)-'user_id')=(to_jsonb(old)-'user_id') then return new;end if;
end if;
raise exception 'Issued receipts and registered signing keys are immutable'; end $$;
create trigger receipts_immutable before update or delete on public.evidence_receipts for each row execute function public.reject_receipt_mutation();
create trigger keys_immutable before update or delete on public.receipt_signing_keys for each row execute function public.reject_receipt_mutation();
-- Auth account deletion can detach ownership without editing signed receipt content.
-- Only owner detachment is allowed; signed content, hashes, identity and timestamps stay immutable.
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
do $$ declare t text; begin
foreach t in array array['watchlists','watchlist_items','alert_rules'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy owner_access on public.%I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
end loop;
foreach t in array array['scans','alert_events','monitoring_jobs'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
end loop;
foreach t in array array['tokens','pools','provider_snapshots','comparison_observations','exit_quotes','evidence_receipts','receipt_signing_keys'] loop
execute format('alter table public.%I enable row level security',t);
end loop; end $$;
create policy public_tokens on public.tokens for select using(true);
create policy public_pools on public.pools for select using(true);
create policy public_comparisons on public.comparison_observations for select using(mode='live');
create policy public_receipts on public.evidence_receipts for select using(mode='live');
create policy public_verification_keys on public.receipt_signing_keys for select using(true);
alter table public.monitoring_runs enable row level security;
create policy owner_runs on public.monitoring_runs for select to authenticated using(exists(select 1 from public.monitoring_jobs j where j.id=job_id and j.user_id=auth.uid()));
alter table public.rate_limit_buckets enable row level security;
-- Source payloads, anonymous scans, rates and private monitoring writes: service role only.
revoke all on public.rate_limit_buckets,public.provider_snapshots,public.exit_quotes from anon,authenticated;
grant select on public.tokens,public.pools,public.comparison_observations,public.evidence_receipts,public.receipt_signing_keys to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.watchlists,public.watchlist_items,public.alert_rules to authenticated;
grant select on public.scans,public.alert_events,public.monitoring_jobs,public.monitoring_runs to authenticated;
create function public.consume_rate_limit(bucket_key text,max_requests integer,window_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer; begin
insert into public.rate_limit_buckets as b values(bucket_key,1,now()+make_interval(secs=>window_seconds))
on conflict on constraint rate_limit_buckets_pkey do update set requests=case when b.expires_at<=now() then 1 else b.requests+1 end,expires_at=case when b.expires_at<=now() then now()+make_interval(secs=>window_seconds) else b.expires_at end returning requests into hits;
return hits<=max_requests; end $$;
revoke all on function public.consume_rate_limit from public,anon,authenticated;
grant execute on function public.consume_rate_limit to service_role;
create function public.claim_monitoring_jobs(batch_size integer default 3) returns setof public.monitoring_jobs language sql security definer set search_path='' as $$
update public.monitoring_jobs set locked_until=now()+interval '5 minutes'
where id in(select id from public.monitoring_jobs where next_run_at<=now() and (locked_until is null or locked_until<now()) order by next_run_at for update skip locked limit least(batch_size,3)) returning *;
$$;
revoke all on function public.claim_monitoring_jobs from public,anon,authenticated;
grant execute on function public.claim_monitoring_jobs to service_role;
create function public.sync_alert_job() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid; tm text; begin
if TG_OP='DELETE' then uid=old.user_id;tm=old.mint;else uid=new.user_id;tm=new.mint;end if;
if TG_OP='UPDATE' then
if old.mint<>new.mint then delete from public.monitoring_jobs where user_id=old.user_id and mint=old.mint and not exists(select 1 from public.alert_rules where user_id=old.user_id and mint=old.mint and enabled);end if;
end if;
if exists(select 1 from public.alert_rules where user_id=uid and mint=tm and enabled) then
insert into public.monitoring_jobs(user_id,mint,position) select uid,tm,position from public.alert_rules where user_id=uid and mint=tm and enabled order by created_at limit 1 on conflict(user_id,mint) do update set position=excluded.position;
else delete from public.monitoring_jobs where user_id=uid and mint=tm;end if;
return null;end $$;
create trigger alert_job_sync after insert or update or delete on public.alert_rules for each row execute function public.sync_alert_job();
create function public.reliability_summary() returns table(provider text,sample_count bigint,success_percent numeric,missing_percent numeric,median_latency_ms double precision,source_time_unknown_percent numeric,first_collected timestamptz,last_collected timestamptz,comparable_count bigint,median_deviation double precision,p95_deviation double precision) language sql stable security definer set search_path='' as $$
with c as(select count(*) n,percentile_cont(.5) within group(order by deviation) median,percentile_cont(.95) within group(order by deviation) p95 from public.comparison_observations where created_at>now()-interval '90 days' and mode='live')
select p.provider,count(*),100.0*count(*) filter(where success)/count(*),100.0*count(*) filter(where jsonb_array_length(payload->'snapshots')=0)/count(*),percentile_cont(.5) within group(order by latency_ms),100.0*count(*) filter(where observed_at is null)/count(*),min(retrieved_at),max(retrieved_at),c.n,c.median,c.p95 from public.provider_snapshots p cross join c where p.created_at>now()-interval '90 days' and p.mode='live' group by p.provider,c.n,c.median,c.p95 having count(*)>=10;
$$;
revoke all on function public.reliability_summary from public;
grant execute on function public.reliability_summary to anon,authenticated;
create function public.prune_observations() returns void language plpgsql security definer set search_path='' as $$ begin
delete from public.provider_snapshots where created_at<now()-interval '90 days';delete from public.comparison_observations where created_at<now()-interval '90 days';delete from public.exit_quotes where created_at<now()-interval '90 days';delete from public.scans where created_at<now()-interval '90 days';delete from public.monitoring_runs where created_at<now()-interval '30 days';delete from public.alert_events where created_at<now()-interval '90 days';delete from public.rate_limit_buckets where expires_at<now()-interval '1 day';end $$;
revoke all on function public.prune_observations from public,anon,authenticated;
grant execute on function public.prune_observations to service_role;
