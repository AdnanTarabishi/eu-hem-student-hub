-- ===== EU-HEM Student Hub: editor dashboard database (Supabase / PostgreSQL) =====
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run. Running it again is safe:
-- it only adds what is missing and refreshes the rules. Setup steps: docs/editor-dashboard.md
--
-- Tables:
--   editors        who may use the dashboard, and their role (admin or editor)
--   announcements  news for the cohort          } both follow the same steps:
--   events         student and social events    } draft -> submitted -> published (or archived)
--   activity_log   who did what, written automatically by the database (nobody can edit it)
--
-- Security: Row Level Security (RLS) is switched on for every table. Without a matching rule
-- ("policy") below, nobody can read or change a row, even with the public key that is in the website.
-- In short:
--   - everyone (also without login) can read PUBLISHED announcements and events, nothing else
--   - editors write drafts and submit them for review; they can never publish
--   - admins can do everything: publish, send back with a note, archive, delete, manage the team
--   - the team is changed only through the admin functions at the end of this file

-- =====================================================================================
-- 1. Editors and roles
-- =====================================================================================
create table if not exists public.editors (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  -- Suggested as "Posted by" in the dashboard; it is public once something is published
  display_name text not null default 'Student Hub team',
  role         text not null check (role in ('admin', 'editor')),
  created_at   timestamptz not null default now()
);

-- "Is the signed-in person an editor / an admin?" Used by the rules below.
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

-- You can see your own editor row; admins see the whole team. Changes only via the admin functions (section 5).
drop policy if exists "editors: read own row, admins read all" on public.editors;
create policy "editors: read own row, admins read all" on public.editors
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- =====================================================================================
-- 2. Content: announcements and events
-- =====================================================================================
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  -- Every row belongs to a cohort, so future cohorts can share the same database
  cohort      text not null default '2026-2028' check (cohort ~ '^\d{4}-\d{4}$'),
  date        date not null default current_date,
  title       text not null check (char_length(btrim(title)) between 3 and 120),
  -- Keep this list the same as ANNOUNCEMENT_CATEGORIES in editor-data.js (a test compares them)
  category    text not null check (category in
                ('Urgent', 'University', 'Academic', 'Student', 'Social', 'Programme', 'Student Hub', 'Student Community')),
  message     text not null check (char_length(btrim(message)) between 1 and 4000),
  link        text check (link is null or link ~* '^https?://'),
  pinned      boolean not null default false,
  expires     date,
  posted_by   text not null default 'Student Hub team' check (char_length(btrim(posted_by)) between 2 and 60),
  status      text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'archived')),
  -- A short note from the admin, e.g. why an item was sent back. Only admins can write it.
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  constraint announcements_expires_after_date check (expires is null or expires >= date)
);
-- Added after the first version of this file (safe if it already exists)
alter table public.announcements add column if not exists review_note text check (review_note is null or char_length(review_note) <= 500);
create index if not exists announcements_public_idx on public.announcements (cohort, status, date desc);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  cohort      text not null default '2026-2028' check (cohort ~ '^\d{4}-\d{4}$'),
  title       text not null check (char_length(btrim(title)) between 3 and 120),
  -- Keep this list the same as EVENT_CATEGORIES in editor-data.js (a test compares them)
  category    text not null check (category in ('Social', 'Academic', 'Career', 'Sports', 'Culture', 'Wellbeing', 'Programme')),
  starts_on   date not null,
  start_time  time,
  ends_on     date,
  end_time    time,
  location    text check (location is null or char_length(btrim(location)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  link        text check (link is null or link ~* '^https?://'),
  posted_by   text not null default 'Student Hub team' check (char_length(btrim(posted_by)) between 2 and 60),
  status      text not null default 'draft' check (status in ('draft', 'submitted', 'published', 'archived')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  constraint events_end_after_start check (ends_on is null or ends_on >= starts_on),
  constraint events_end_time_after_start check (
    end_time is null or start_time is null or coalesce(ends_on, starts_on) > starts_on or end_time >= start_time)
);
create index if not exists events_public_idx on public.events (cohort, status, starts_on);

-- Bookkeeping that nobody can fake from the website, for both tables:
-- updated_at is always "now", created_by never changes, publishing records who approved it,
-- and only admins can write the review note.
-- (In the SQL Editor nobody is signed in, so auth.uid() is empty: there the given values are kept.
--  Only project owners can open the SQL Editor. This is how scripts/announcements-to-sql.js imports.)
create or replace function public.content_bookkeeping() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
    new.reviewed_by := null;
    new.reviewed_at := null;
    if auth.uid() is not null and not public.is_admin() then new.review_note := null; end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    if auth.uid() is not null and not public.is_admin() then new.review_note := old.review_note; end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    new.review_note := null; -- published: the note has done its job
  end if;
  return new;
end;
$$;

-- The first version of this file had a trigger with another name: remove it if present
drop trigger if exists announcements_bookkeeping on public.announcements;
drop function if exists public.announcements_bookkeeping();

drop trigger if exists content_bookkeeping on public.announcements;
create trigger content_bookkeeping before insert or update on public.announcements
  for each row execute function public.content_bookkeeping();
drop trigger if exists content_bookkeeping on public.events;
create trigger content_bookkeeping before insert or update on public.events
  for each row execute function public.content_bookkeeping();

-- =====================================================================================
-- 3. The same access rules for both content tables
-- =====================================================================================
-- The loop writes the five rules once per table, so announcements and events can never drift apart.
do $$
declare t text;
begin
  foreach t in array array['announcements', 'events'] loop
    execute format('alter table public.%I enable row level security', t);

    -- Reading: published items are public; editors also see drafts and submitted ones
    execute format('drop policy if exists "public reads published" on public.%I', t);
    execute format($p$create policy "public reads published" on public.%I for select to anon, authenticated
      using (status = 'published' or public.is_editor())$p$, t);

    -- Adding: editors add drafts or submitted items; admins may publish directly
    execute format('drop policy if exists "editors add" on public.%I', t);
    execute format($p$create policy "editors add" on public.%I for insert to authenticated
      with check (public.is_editor() and (status in ('draft', 'submitted') or public.is_admin()))$p$, t);

    -- Changing: admins change anything; an editor only their own unpublished items, and cannot publish
    execute format('drop policy if exists "admins change all" on public.%I', t);
    execute format($p$create policy "admins change all" on public.%I for update to authenticated
      using (public.is_admin()) with check (public.is_admin())$p$, t);
    execute format('drop policy if exists "editors change own drafts" on public.%I', t);
    execute format($p$create policy "editors change own drafts" on public.%I for update to authenticated
      using (public.is_editor() and created_by = auth.uid() and status in ('draft', 'submitted'))
      with check (public.is_editor() and created_by = auth.uid() and status in ('draft', 'submitted'))$p$, t);

    -- Deleting: admins anything; an editor only their own drafts
    execute format('drop policy if exists "delete" on public.%I', t);
    execute format($p$create policy "delete" on public.%I for delete to authenticated
      using (public.is_admin() or (public.is_editor() and created_by = auth.uid() and status = 'draft'))$p$, t);

    -- Table permissions (RLS above decides which ROWS; these decide which ACTIONS)
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Rule names of the first version of this file (replaced by the loop above)
drop policy if exists "announcements: public reads published" on public.announcements;
drop policy if exists "announcements: editors add" on public.announcements;
drop policy if exists "announcements: admins change all" on public.announcements;
drop policy if exists "announcements: editors change own drafts" on public.announcements;
drop policy if exists "announcements: delete" on public.announcements;

-- =====================================================================================
-- 4. Activity log: written by the database itself after every change
-- =====================================================================================
create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,          -- who (empty when done in the SQL Editor)
  actor_email text,
  item_table  text not null, -- announcements, events or editors
  item_id     uuid,
  item_title  text,
  action      text not null, -- e.g. "published", "sent back to draft", "deleted"
  detail      text           -- e.g. the review note
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);

alter table public.activity_log enable row level security;
-- The whole team may read the log (transparency); nobody can write or change it through the website
drop policy if exists "editors read the log" on public.activity_log;
create policy "editors read the log" on public.activity_log for select to authenticated using (public.is_editor());
revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

create or replace function public.log_content_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_id uuid;
  v_title text;
  v_detail text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id; v_title := old.title; v_action := 'deleted';
  else
    v_id := new.id; v_title := new.title;
    if tg_op = 'INSERT' then
      v_action := case new.status when 'published' then 'created and published'
                                  when 'submitted' then 'created and sent for review'
                                  else 'created a draft' end;
    elsif new.status is distinct from old.status then
      v_action := case
        when new.status = 'published' then 'published'
        when new.status = 'submitted' then 'sent for review'
        when new.status = 'archived' then 'archived'
        when old.status = 'submitted' then 'sent back to draft'
        when old.status = 'archived' then 'restored as draft'
        else 'moved to drafts' end;
      v_detail := new.review_note;
    else
      v_action := 'edited';
    end if;
  end if;
  insert into public.activity_log (actor, actor_email, item_table, item_id, item_title, action, detail)
  values (auth.uid(),
          coalesce((select email from public.editors where user_id = auth.uid()), case when auth.uid() is null then 'SQL Editor' end),
          tg_table_name, v_id, v_title, v_action, v_detail);
  return null;
end;
$$;

drop trigger if exists log_content_change on public.announcements;
create trigger log_content_change after insert or update or delete on public.announcements
  for each row execute function public.log_content_change();
drop trigger if exists log_content_change on public.events;
create trigger log_content_change after insert or update or delete on public.events
  for each row execute function public.log_content_change();

-- =====================================================================================
-- 5. Team management (admins only, from the dashboard's Team tab)
-- =====================================================================================
-- The person must first have an account: Supabase -> Authentication -> Users -> Add user.
-- Then an admin adds them to the team here. The last admin can never be removed or demoted,
-- so the project can't lock itself out.

create or replace function public.add_editor(p_email text, p_role text, p_display_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_email text := lower(btrim(p_email));
begin
  if not public.is_admin() then raise exception 'Only admins can manage the team.' using errcode = '42501'; end if;
  if p_role not in ('admin', 'editor') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    raise exception 'No account with this email yet. Create it first in Supabase: Authentication > Users > Add user.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.editors where user_id = v_user) then
    raise exception 'This person is already in the team.' using errcode = '23505';
  end if;
  insert into public.editors (user_id, email, display_name, role)
  values (v_user, v_email, coalesce(nullif(btrim(p_display_name), ''), 'Student Hub team'), p_role);
  insert into public.activity_log (actor, actor_email, item_table, item_title, action)
  values (auth.uid(), (select email from public.editors where user_id = auth.uid()), 'editors', v_email, 'added as ' || p_role);
end;
$$;

create or replace function public.update_editor(p_user_id uuid, p_role text, p_display_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_old text; v_email text;
begin
  if not public.is_admin() then raise exception 'Only admins can manage the team.' using errcode = '42501'; end if;
  if p_role not in ('admin', 'editor') then raise exception 'Unknown role.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 2 and 60 then
    raise exception 'The display name needs 2–60 characters.' using errcode = '22023';
  end if;
  select role, email into v_old, v_email from public.editors where user_id = p_user_id;
  if v_old is null then raise exception 'This person is not in the team.' using errcode = 'P0002'; end if;
  if v_old = 'admin' and p_role <> 'admin' and (select count(*) from public.editors where role = 'admin') = 1 then
    raise exception 'The team needs at least one admin.' using errcode = '23514';
  end if;
  update public.editors set role = p_role, display_name = btrim(p_display_name) where user_id = p_user_id;
  if v_old <> p_role then
    insert into public.activity_log (actor, actor_email, item_table, item_title, action)
    values (auth.uid(), (select email from public.editors where user_id = auth.uid()), 'editors', v_email, 'role changed to ' || p_role);
  end if;
end;
$$;

create or replace function public.remove_editor(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text; v_email text;
begin
  if not public.is_admin() then raise exception 'Only admins can manage the team.' using errcode = '42501'; end if;
  select role, email into v_role, v_email from public.editors where user_id = p_user_id;
  if v_role is null then raise exception 'This person is not in the team.' using errcode = 'P0002'; end if;
  if v_role = 'admin' and (select count(*) from public.editors where role = 'admin') = 1 then
    raise exception 'The team needs at least one admin.' using errcode = '23514';
  end if;
  -- Their content stays (created_by keeps pointing to their account); they just lose access
  delete from public.editors where user_id = p_user_id;
  insert into public.activity_log (actor, actor_email, item_table, item_title, action)
  values (auth.uid(), (select email from public.editors where user_id = auth.uid()), 'editors', v_email, 'removed from the team');
end;
$$;

-- =====================================================================================
-- 6. Function permissions
-- =====================================================================================
revoke execute on function public.is_editor(), public.is_admin() from public;
grant execute on function public.is_editor(), public.is_admin() to anon, authenticated;
revoke execute on function public.add_editor(text, text, text), public.update_editor(uuid, text, text),
  public.remove_editor(uuid), public.log_content_change(), public.content_bookkeeping() from public, anon;
grant execute on function public.add_editor(text, text, text), public.update_editor(uuid, text, text),
  public.remove_editor(uuid) to authenticated;

-- The editors table itself: read only (see section 1); never written directly through the website
revoke all on public.editors from anon, authenticated;
grant select on public.editors to authenticated;
