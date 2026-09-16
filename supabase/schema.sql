-- PVMS (Prodip Volunteer Management System) — schema + RLS hardening
-- Run this once in the new Supabase project's SQL Editor (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT).

-- ───────────────────────── 1. CONFIG ─────────────────────────
-- Single source of truth for the "sole Master Admin" identity, so it's a data
-- change (one UPDATE) instead of a code change if that person ever changes.
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
insert into public.app_config (key, value) values ('master_admin_student_id', '2101103')
  on conflict (key) do nothing;

-- ───────────────────────── 2. ROLES (lookup) ─────────────────────────
create table if not exists public.roles (
  level int primary key,
  name  text not null
);
insert into public.roles (level, name) values
  (1, 'Trainee Volunteer'),
  (2, 'Active Volunteer'),
  (3, 'Coordinator'),
  (4, 'Senior Coordinator'),
  (5, 'Assistant Director'),
  (6, 'System Administrator')
  on conflict (level) do update set name = excluded.name;

-- ───────────────────────── 3. VOLUNTEERS ─────────────────────────
create table if not exists public.volunteers (
  id              uuid primary key default gen_random_uuid(),
  student_id      text unique not null,
  full_name       text not null,
  email           text unique,
  department      text,
  batch           text,
  role_level      int not null default 1 references public.roles(level),
  target_classes  int not null default 20,
  designated_days text[] not null default '{}',
  phone           text,
  phone_is_public boolean not null default false,
  fb_profile_url  text,
  fb_is_public    boolean not null default true,
  -- Links this roster row to a real Supabase Auth account (Phase 1 hardening —
  -- replaces the old shared-password client-side gate).
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ───────────────────────── 4. ACTIVITIES ─────────────────────────
-- Column is `title`, not `name` — the old admin.html used `name` and silently
-- broke; co-ordinator.html and the spec both correctly use `title`.
create table if not exists public.activities (
  id         serial primary key,
  title      text unique not null,
  category   text,
  multiplier numeric not null default 1.0,
  status     text not null default 'Active' check (status in ('Active', 'Inactive')),
  notes      text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── 5. ATTENDANCE LOGS ─────────────────────────
-- No foreign keys to volunteers/activities by design (spec: historical logs
-- must survive roster edits/renames). The CHECK below enforces the
-- "Replacement Teacher" golden rule at the database level regardless of
-- client-side bugs: credit always belongs to the replacement if one exists.
create table if not exists public.attendance_logs (
  id                bigserial primary key,
  session_date      date not null,
  day_of_week       text not null,
  activity_title    text not null,
  instructor_id     text not null,
  instructor_name   text not null,
  replacement_id    text,
  replacement_name  text,
  credited_to_id    text not null,
  in_time           text not null,
  out_time          text,
  topic_covered     text,
  is_designated_day boolean not null default false,
  validator_id      text not null,
  verified_by       text not null,
  status            text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  created_at        timestamptz not null default now(),
  constraint credited_to_matches_golden_rule
    check (credited_to_id = coalesce(replacement_id, instructor_id))
);

-- ───────────────────────── 6. HELPER FUNCTIONS ─────────────────────────
-- STABLE + SECURITY DEFINER: read-only, run as the function owner so they can
-- see the volunteers table regardless of the calling user's own RLS grants.
create or replace function public.current_student_id()
returns text language sql stable security definer set search_path = public as $$
  select student_id from public.volunteers where auth_user_id = auth.uid();
$$;

create or replace function public.current_role_level()
returns int language sql stable security definer set search_path = public as $$
  select role_level from public.volunteers where auth_user_id = auth.uid();
$$;

create or replace function public.is_master_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.volunteers v
    join public.app_config c on c.key = 'master_admin_student_id'
    where v.auth_user_id = auth.uid()
      and v.role_level = 6
      and v.student_id = c.value
  );
$$;

-- ───────────────────────── 7. AUTH LINKING ─────────────────────────
-- A volunteer must already exist on the roster (added by the Master Admin)
-- before they can create a login — signup fails otherwise. This replaces the
-- old shared "prodip2026" password with one real account per person.
create or replace function public.link_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.volunteers
  set auth_user_id = new.id
  where email = new.email and auth_user_id is null;

  if not found then
    raise exception 'This email is not on the Prodip volunteer roster yet. Ask the Master Admin to add you first.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_new_auth_user();

-- ───────────────────────── 8. SELF-UPDATE COLUMN GUARD ─────────────────────────
-- A logged-in volunteer may update their OWN row, but only the contact/privacy
-- fields (phone, fb_profile_url, phone_is_public, fb_is_public). Anything else
-- — role_level, target_classes, designated_days, student_id, full_name — can
-- only change via the Master Admin path. RLS alone is row-level, not
-- column-level, so this trigger is what actually enforces that split.
create or replace function public.guard_volunteer_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_master_admin() then
    return new;
  end if;

  if new.student_id      is distinct from old.student_id
     or new.full_name     is distinct from old.full_name
     or new.department    is distinct from old.department
     or new.batch         is distinct from old.batch
     or new.role_level    is distinct from old.role_level
     or new.target_classes is distinct from old.target_classes
     or new.designated_days is distinct from old.designated_days
     or new.email          is distinct from old.email
  then
    raise exception 'Only the Master Admin can change roster fields. You can update your phone, Facebook link, and their visibility.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_volunteer_self_update on public.volunteers;
create trigger guard_volunteer_self_update
  before update on public.volunteers
  for each row execute function public.guard_volunteer_self_update();

-- ───────────────────────── 9. ROW-LEVEL SECURITY ─────────────────────────
alter table public.app_config       enable row level security;
alter table public.roles            enable row level security;
alter table public.volunteers       enable row level security;
alter table public.activities       enable row level security;
alter table public.attendance_logs  enable row level security;

-- roles: readable by anyone (needed to render role badges), no client writes.
drop policy if exists roles_select_all on public.roles;
create policy roles_select_all on public.roles for select using (true);

-- app_config: server-side only, no client access at all (no policies = deny-all).

-- volunteers
drop policy if exists volunteers_select on public.volunteers;
create policy volunteers_select on public.volunteers for select
  using (
    auth_user_id = auth.uid()             -- self
    or public.current_role_level() >= 3   -- coordinators+ need the roster for dropdowns
    or public.is_master_admin()
  );

drop policy if exists volunteers_insert on public.volunteers;
create policy volunteers_insert on public.volunteers for insert
  with check (public.is_master_admin());

drop policy if exists volunteers_update on public.volunteers;
create policy volunteers_update on public.volunteers for update
  using (auth_user_id = auth.uid() or public.is_master_admin())
  with check (auth_user_id = auth.uid() or public.is_master_admin());
  -- column-level enforcement is the trigger above, not this policy

drop policy if exists volunteers_delete on public.volunteers;
create policy volunteers_delete on public.volunteers for delete
  using (public.is_master_admin());

-- activities: public read (shown on the logged-out landing page), admin-only write.
drop policy if exists activities_select_all on public.activities;
create policy activities_select_all on public.activities for select using (true);

drop policy if exists activities_write on public.activities;
create policy activities_write on public.activities for insert
  with check (public.is_master_admin());
drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities for update
  using (public.is_master_admin()) with check (public.is_master_admin());
drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities for delete
  using (public.is_master_admin());

-- attendance_logs
drop policy if exists attendance_select on public.attendance_logs;
create policy attendance_select on public.attendance_logs for select
  using (
    public.is_master_admin()
    or public.current_role_level() >= 3                 -- coordinators+ can audit all logs
    or credited_to_id = public.current_student_id()      -- a volunteer sees their own approved history
  );

-- Coordinators (role_level >= 3) log work; validator_id must be their OWN
-- student_id — a coordinator cannot stamp a session as verified by someone
-- else. New rows always start 'Pending' (the two-tier pipeline).
drop policy if exists attendance_insert on public.attendance_logs;
create policy attendance_insert on public.attendance_logs for insert
  with check (
    public.current_role_level() >= 3
    and validator_id = public.current_student_id()
    and status = 'Pending'
  );

-- Only the Master Admin can move a log out of Pending (the approval step).
drop policy if exists attendance_update on public.attendance_logs;
create policy attendance_update on public.attendance_logs for update
  using (public.is_master_admin())
  with check (public.is_master_admin());

-- No delete policy: attendance history is permanent, even for the admin
-- (default-deny — matches the spec's audit-trail intent).

-- ───────────────────────── Done ─────────────────────────
-- Next: in Authentication → Providers, confirm Email is enabled; in
-- Authentication → Settings, you may want to turn OFF "Confirm email" while
-- testing so new volunteer accounts can log in immediately.
-- Then add real people to `volunteers` (Master Admin first, matching the
-- app_config student ID above) before anyone tries to sign up.
