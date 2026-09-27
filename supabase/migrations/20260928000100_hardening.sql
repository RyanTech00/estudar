-- Defence in depth: RLS already blocks all of this, but grants make a future policy mistake harmless.

-- Nobody signed out ever needs the study data.
revoke all on table public.user_data from anon;

-- ai_usage is server-only (secret key). Clients can't read it, reset it or bump it.
revoke all on table public.ai_usage from anon, authenticated;

-- A document is a study plan and its logs: a few hundred KB at most. 2 MB stops anyone filling the database.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_data_size') then
    alter table public.user_data add constraint user_data_size check (pg_column_size(data) < 2000000);
  end if;
end $$;

-- Daily AI limit, taken atomically BEFORE calling the model: one statement reads and bumps the counter,
-- so parallel requests can't all see "0 used". Returns the new count, or null when the limit is reached.
create or replace function public.ai_usage_take(p_user uuid, p_day date, p_max int)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, count)
  select p_user, p_day, 1 where coalesce(p_max, 0) > 0
  on conflict (user_id, day) do update set count = u.count + 1
    where u.count < p_max
  returning u.count;
$$;

-- Only the server (service_role) may call it.
revoke all on function public.ai_usage_take(uuid, date, int) from public, anon, authenticated;
grant execute on function public.ai_usage_take(uuid, date, int) to service_role;
