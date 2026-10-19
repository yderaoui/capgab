-- Execute against a disposable migrated Supabase database; all fixture writes roll back.
begin;
insert into auth.users(id,aud,role,email) values('00000000-0000-4000-8000-000000000001','authenticated','authenticated','one@example.test'),('00000000-0000-4000-8000-000000000002','authenticated','authenticated','two@example.test');
insert into public.watchlist_items(user_id,mint,name,symbol) values('00000000-0000-4000-8000-000000000001','mint-one','One','ONE'),('00000000-0000-4000-8000-000000000002','mint-two','Two','TWO');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin if (select count(*) from public.watchlist_items)<>1 then raise exception 'RLS leaked another owner';end if;end $$;
do $$ begin update public.watchlist_items set name='Hacked' where mint='mint-two';if found then raise exception 'Cross-owner update succeeded';end if;end $$;
reset role;
set local role anon;
do $$ begin if (select count(*) from public.evidence_receipts)>0 then raise notice 'Public receipts accessible';end if;end $$;
rollback;
