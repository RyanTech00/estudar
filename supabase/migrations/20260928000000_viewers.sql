-- Viewers: people the owner lets follow their plan and progress, read-only.
-- Access is tied to the viewer's ACCOUNT (viewer_id), never to an email string: if an account is
-- deleted, its rows go with it (on delete cascade), so nobody can later sign up with that email and
-- inherit the access. `email` is only for showing the list to the owner.
-- Only the setup server writes here (with the secret key, which bypasses RLS). There are no
-- insert/update/delete policies on purpose: if a client could insert a row, anyone could add
-- themselves as a viewer of someone else's data.
-- Dev databases may hold an earlier, unreleased shape (keyed by email): replace it.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'viewers')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'viewers' and column_name = 'viewer_id') then
    drop table public.viewers cascade;
  end if;
end $$;

create table if not exists public.viewers (
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create index if not exists viewers_viewer_idx on public.viewers (viewer_id);

alter table public.viewers enable row level security;

-- The owner sees who follows them; a viewer sees whose data they follow.
drop policy if exists "viewers select own" on public.viewers;
create policy "viewers select own" on public.viewers
  for select to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));

-- A viewer can read (never write) the owner's document. Writes stay "own row only" (init migration).
-- Removing the viewers row ends access at once, even for a session that is still open.
drop policy if exists "user_data select as viewer" on public.user_data;
create policy "user_data select as viewer" on public.user_data
  for select to authenticated
  using (
    exists (
      select 1 from public.viewers v
      where v.owner_id = user_data.user_id
        and v.viewer_id = (select auth.uid())
    )
  );

-- Clients only ever read this table (and only through the policy above).
revoke all on table public.viewers from anon, authenticated;
grant select on table public.viewers to authenticated;
