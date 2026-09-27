-- One JSON document per user: plan, sessions, focus minutes, checklist, settings.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "user_data select own" on public.user_data;
drop policy if exists "user_data insert own" on public.user_data;
drop policy if exists "user_data update own" on public.user_data;
drop policy if exists "user_data delete own" on public.user_data;

create policy "user_data select own" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data insert own" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data update own" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_data delete own" on public.user_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Live sync between a user's devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_data'
  ) then
    alter publication supabase_realtime add table public.user_data;
  end if;
end $$;

-- Daily AI generation counter. Only the edge function (service role) touches it:
-- RLS on with no policies means clients can neither read nor write it.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
