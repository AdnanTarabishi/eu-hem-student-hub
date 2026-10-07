-- ===== EU-HEM Student Hub: editor dashboard database (Supabase / PostgreSQL) =====
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run. Running it again is safe.
-- Setup steps: docs/editor-dashboard.md
--
-- Two tables:
--   editors        who may use the dashboard, and their role (admin or editor)
--   announcements  every announcement, with a status: draft -> submitted -> published (or archived)
--
-- Security: Row Level Security (RLS) is switched on for both tables. Without a matching rule
-- ("policy") below, nobody can read or change a row, even with the public key that is in the website.
-- In short:
--   - everyone (also without login) can read PUBLISHED announcements, nothing else
--   - editors can write drafts and submit them for review; they can never publish
--   - admins can do everything: publish, send back, archive, delete
--   - nobody can make themselves an editor: only an admin, in the SQL Editor (see the docs)

-- ----- Editors -----
create table if not exists public.editors (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  -- Shown as "Posted by" suggestion in the dashboard; it is public once an announcement is published
  display_name text not null default 'Student Hub team',
  role         text not null check (role in ('admin', 'editor')),
  created_at   timestamptz not null default now()
);

-- "Is the logged-in person an editor / an admin?" Used by the rules below.
-- security definer: the function may look into the editors table even though the person
-- asking may not; it only ever answers yes or no about themselves.
create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.editors where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.editors where user_id = auth.uid() and role = 'admin');
$$;

alter table public.editors enable row level security;

-- You can see your own editor row; admins see all. Nobody changes this table from the website.
drop policy if exists "editors: read own row, admins read all" on public.editors;
create policy "editors: read own row, admins read all" on public.editors
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ----- Announcements -----
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  -- Every row belongs to a cohort, so future cohorts can share the same database
  cohort      text not null default '2026-2028' check (cohort ~ '^\d{4}-\d{4}$'),
  date        date not null default current_date,
  title       text not null check (char_length(btrim(title)) between 3 and 120),
  -- Keep this list the same as CATEGORIES in editor-data.js (a test compares them)
  category    text not null check (category in
                ('Urgent', 'University', 'Academic', 'Student', 'Social', 'Programme', 'Student Hub', 'Student Community')),
  message     text not null check (char_length(btrim(message)) between 1 and 4000),
  link        text check (link is null or link ~* '^https?://'),
  pinned      boolean not null default false,
  expires     date,
  posted_by   text not null default 'Student Hub team' check (char_length(btrim(posted_by)) between 2 and 60),
  status      text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'archived')),
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  constraint announcements_expires_after_date check (expires is null or expires >= date)
);

create index if not exists announcements_public_idx on public.announcements (cohort, status, date desc);

-- Bookkeeping that nobody can fake from the website:
-- updated_at is always "now", created_by never changes, and publishing records who approved it.
-- (In the SQL Editor nobody is signed in, so auth.uid() is empty: there the given created_by is kept.
--  Only project owners can open the SQL Editor. This is how scripts/announcements-to-sql.js imports.)
create or replace function public.announcements_bookkeeping() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists announcements_bookkeeping on public.announcements;
create trigger announcements_bookkeeping before insert or update on public.announcements
  for each row execute function public.announcements_bookkeeping();

alter table public.announcements enable row level security;

-- Reading: published announcements are public; editors also see drafts and submitted ones
drop policy if exists "announcements: public reads published" on public.announcements;
create policy "announcements: public reads published" on public.announcements
  for select to anon, authenticated
  using (status = 'published' or public.is_editor());

-- Adding: editors add drafts or submitted items; admins may publish directly
drop policy if exists "announcements: editors add" on public.announcements;
create policy "announcements: editors add" on public.announcements
  for insert to authenticated
  with check (public.is_editor() and (status in ('draft', 'submitted') or public.is_admin()));

-- Changing: admins change anything; an editor only their own unpublished items, and cannot publish
drop policy if exists "announcements: admins change all" on public.announcements;
create policy "announcements: admins change all" on public.announcements
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "announcements: editors change own drafts" on public.announcements;
create policy "announcements: editors change own drafts" on public.announcements
  for update to authenticated
  using (public.is_editor() and created_by = auth.uid() and status in ('draft', 'submitted'))
  with check (public.is_editor() and created_by = auth.uid() and status in ('draft', 'submitted'));

-- Deleting: admins anything; an editor only their own drafts
drop policy if exists "announcements: delete" on public.announcements;
create policy "announcements: delete" on public.announcements
  for delete to authenticated
  using (public.is_admin() or (public.is_editor() and created_by = auth.uid() and status = 'draft'));

-- ----- Table permissions (RLS above decides which ROWS; these decide which ACTIONS) -----
revoke all on public.editors from anon, authenticated;
grant select on public.editors to authenticated;
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to anon;
grant select, insert, update, delete on public.announcements to authenticated;
revoke execute on function public.is_editor(), public.is_admin() from public;
grant execute on function public.is_editor(), public.is_admin() to anon, authenticated;
