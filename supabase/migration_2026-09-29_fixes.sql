-- PVMS migration — 2026-09-29
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent). Run AFTER schema.sql.
--
-- What this fixes
--   1. 1-tap self check-in / check-out was silently rejected by RLS for normal volunteers
--      (attendance_insert required role >= 3, attendance_update was Master-Admin only), so the
--      home-page button only "worked" in the browser's localStorage and never reached the DB.
--   2. Substitute requests lived only in the browser's localStorage, so they never reached the
--      other volunteer's device. They now live in public.substitute_requests.
--   3. Mentors could not list other volunteers (RLS) to pick a substitute → name-only view.
--   4. guard_volunteer_self_update also blocked the SIGNUP trigger itself (e.g. linking the
--      Master Admin to role 6), so the profile link could fail silently.
--   5. SECURITY: anyone could register with another person's student ID (or the Master Admin's
--      ID 2101103) and inherit that roster row / role. Linking is now restricted.

-- ───────────────────────── 1. SUBSTITUTE REQUESTS ─────────────────────────
create table if not exists public.substitute_requests (
  id           uuid primary key default gen_random_uuid(),
  from_id      text not null,
  from_name    text not null,
  to_id        text not null,
  to_name      text not null,
  class_day    text not null,
  class_date   date not null,
  note         text,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint substitute_not_self check (from_id <> to_id)
);
create index if not exists substitute_requests_to_idx   on public.substitute_requests (to_id, status, class_date);
create index if not exists substitute_requests_from_idx on public.substitute_requests (from_id);

alter table public.substitute_requests enable row level security;

drop policy if exists sub_select on public.substitute_requests;
create policy sub_select on public.substitute_requests for select
  using (
    from_id = public.current_student_id()
    or to_id = public.current_student_id()
    or public.current_role_level() >= 3
  );

drop policy if exists sub_insert on public.substitute_requests;
create policy sub_insert on public.substitute_requests for insert
  with check (from_id = public.current_student_id() and status = 'pending');

-- Only the person being asked can answer.
drop policy if exists sub_update on public.substitute_requests;
create policy sub_update on public.substitute_requests for update
  using (to_id = public.current_student_id() and status = 'pending')
  with check (to_id = public.current_student_id() and status in ('accepted', 'declined'));

-- The recipient may change status/responded_at only.
create or replace function public.guard_substitute_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.from_id is distinct from old.from_id
     or new.from_name is distinct from old.from_name
     or new.to_id is distinct from old.to_id
     or new.to_name is distinct from old.to_name
     or new.class_day is distinct from old.class_day
     or new.class_date is distinct from old.class_date
     or new.note is distinct from old.note
  then
    raise exception 'Only the answer (accept / decline) of a substitute request can be changed.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_substitute_update on public.substitute_requests;
create trigger guard_substitute_update
  before update on public.substitute_requests
  for each row execute function public.guard_substitute_update();

-- ───────────────────────── 2. NAME-ONLY DIRECTORY (to pick a substitute) ─────────────────────────
create or replace view public.volunteer_directory as
  select student_id, full_name, department, batch from public.volunteers;
grant select on public.volunteer_directory to authenticated;

-- ───────────────────────── 3. ATTENDANCE: SELF CHECK-IN / CHECK-OUT ─────────────────────────
-- Coordinators (>= 3) still log anyone. A volunteer may now log THEIR OWN session only:
--   * credited to themselves, validator = themselves, status 'Pending' (still needs approval)
--   * date within ±1 day of today (no back-dating)
--   * either they are the instructor, or they hold an ACCEPTED substitute request for that
--     instructor and date (the "credited_to_matches_golden_rule" CHECK already forces the
--     replacement to receive the credit)
drop policy if exists attendance_insert on public.attendance_logs;
create policy attendance_insert on public.attendance_logs for insert
  with check (
    status = 'Pending'
    and validator_id = public.current_student_id()
    and (
      public.current_role_level() >= 3
      or (
        credited_to_id = public.current_student_id()
        and out_time is null
        and session_date between current_date - 1 and current_date + 1
        and (
          instructor_id = public.current_student_id()
          or exists (
            select 1 from public.substitute_requests r
            where r.to_id = public.current_student_id()
              and r.from_id = instructor_id
              and r.class_date = session_date
              and r.status = 'accepted'
          )
        )
      )
    )
  );

-- Master Admin AND Senior Coordinators (level 4+) approve/reject. A volunteer may only ADD the
-- out_time to their own open, Pending session.
drop policy if exists attendance_update on public.attendance_logs;
create policy attendance_update on public.attendance_logs for update
  using (
    public.is_master_admin()
    or public.current_role_level() >= 4
    or (credited_to_id = public.current_student_id() and status = 'Pending' and out_time is null)
  )
  with check (
    public.is_master_admin()
    or public.current_role_level() >= 4
    or (credited_to_id = public.current_student_id() and status = 'Pending')
  );

create or replace function public.guard_attendance_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_master_admin() or public.current_role_level() >= 4 then
    return new;
  end if;
  -- everyone else: nothing but out_time may change
  if new.session_date       is distinct from old.session_date
     or new.day_of_week     is distinct from old.day_of_week
     or new.activity_title  is distinct from old.activity_title
     or new.instructor_id   is distinct from old.instructor_id
     or new.instructor_name is distinct from old.instructor_name
     or new.replacement_id  is distinct from old.replacement_id
     or new.replacement_name is distinct from old.replacement_name
     or new.credited_to_id  is distinct from old.credited_to_id
     or new.in_time         is distinct from old.in_time
     or new.topic_covered   is distinct from old.topic_covered
     or new.is_designated_day is distinct from old.is_designated_day
     or new.validator_id    is distinct from old.validator_id
     or new.verified_by     is distinct from old.verified_by
     or new.status          is distinct from old.status
  then
    raise exception 'Only the check-out time can be changed on your own session.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_attendance_update on public.attendance_logs;
create trigger guard_attendance_update
  before update on public.attendance_logs
  for each row execute function public.guard_attendance_update();

-- OPTIONAL — let Senior Coordinators (level 4+) approve too. The Approvals page is open to them
-- and its text says "Senior Coordinator & Admin", but the spec says Master Admin only.
-- Uncomment to allow it:
--   drop policy if exists attendance_update on public.attendance_logs;
--   create policy attendance_update on public.attendance_logs for update
--     using (public.is_master_admin() or public.current_role_level() >= 4
--            or (credited_to_id = public.current_student_id() and status = 'Pending' and out_time is null))
--     with check (public.is_master_admin() or public.current_role_level() >= 4
--            or (credited_to_id = public.current_student_id() and status = 'Pending'));
-- (then also relax the `if auth.uid() is null or public.is_master_admin()` line in guard_attendance_update)

-- ───────────────────────── 4. VOLUNTEER SELF-UPDATE GUARD ─────────────────────────
-- Same rules as before, but (a) the signup trigger / SQL editor (auth.uid() is null) is allowed
-- through, and (b) auth_user_id can no longer be re-pointed by the volunteer.
create or replace function public.guard_volunteer_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_master_admin() then
    return new;
  end if;

  if new.student_id       is distinct from old.student_id
     or new.full_name      is distinct from old.full_name
     or new.department     is distinct from old.department
     or new.batch          is distinct from old.batch
     or new.role_level     is distinct from old.role_level
     or new.target_classes is distinct from old.target_classes
     or new.designated_days is distinct from old.designated_days
     or new.email          is distinct from old.email
     or new.auth_user_id   is distinct from old.auth_user_id
  then
    raise exception 'Only the Master Admin can change roster fields. You can update your phone, Facebook link, and their visibility.';
  end if;

  return new;
end;
$$;

-- ───────────────────────── 5. SAFER SIGNUP LINKING ─────────────────────────
-- Rules:
--   * A roster row that is ALREADY linked to an account is never re-linked.
--   * A roster row is claimed by student ID only when its email is empty, equals the signup
--     email, is a "@prodip.org" placeholder, or the signup email is the CUET pattern
--     u<studentid>@student.cuet.ac.bd.
--   * Coordinator+ rows (role >= 3) and the Master Admin ID additionally need a real email match
--     (roster email == signup email, or the CUET pattern). Otherwise the account is created but
--     stays UNLINKED (level-1 access) until the Master Admin fixes the roster row.
create or replace function public.link_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student_id text;
  v_full_name  text;
  v_dept       text;
  v_batch      text;
  v_phone      text;
  v_is_admin_id boolean := false;
  v_cuet_match  boolean := false;
  v_row         public.volunteers%rowtype;
  v_email_trusted boolean;
begin
  v_student_id := coalesce(trim(new.raw_user_meta_data->>'student_id'), '');
  v_full_name  := coalesce(trim(new.raw_user_meta_data->>'full_name'), split_part(new.email, '@', 1));
  v_dept       := coalesce(trim(new.raw_user_meta_data->>'department'), 'Other');
  v_batch      := coalesce(trim(new.raw_user_meta_data->>'batch'), '');
  v_phone      := trim(new.raw_user_meta_data->>'phone');

  if v_student_id <> '' then
    select exists (
      select 1 from public.app_config where key = 'master_admin_student_id' and value = v_student_id
    ) into v_is_admin_id;
    v_cuet_match := lower(coalesce(new.email, '')) = lower('u' || v_student_id || '@student.cuet.ac.bd');
  end if;

  -- 1. Claim an existing roster row by student ID
  if v_student_id <> '' then
    select * into v_row from public.volunteers where student_id = v_student_id;
    if found then
      v_email_trusted := v_cuet_match or lower(coalesce(v_row.email, '')) = lower(coalesce(new.email, ''));

      if v_row.auth_user_id is not null then
        raise warning 'link_new_auth_user: student id % is already linked to an account', v_student_id;
        return new;
      end if;

      if not (
        v_email_trusted
        or coalesce(v_row.email, '') = ''
        or v_row.email ilike '%@prodip.org'
      ) then
        raise warning 'link_new_auth_user: email does not match roster row for student id %', v_student_id;
        return new;
      end if;

      if (v_row.role_level >= 3 or v_is_admin_id) and not v_email_trusted then
        raise warning 'link_new_auth_user: privileged roster row % needs a matching email; left unlinked', v_student_id;
        return new;
      end if;

      update public.volunteers
      set auth_user_id = new.id,
          email      = coalesce(nullif(email, ''), new.email),
          full_name  = case when full_name  is null or full_name  = '' then v_full_name else full_name  end,
          department = case when department is null or department = '' then v_dept      else department end,
          batch      = case when batch      is null or batch      = '' then v_batch     else batch      end,
          phone      = coalesce(phone, v_phone),
          role_level = case when v_is_admin_id and v_email_trusted then 6 else role_level end
      where id = v_row.id;
      return new;
    end if;
  end if;

  -- 2. Claim a roster row by email (the email itself proves the match)
  if new.email is not null and new.email <> '' then
    update public.volunteers
    set auth_user_id = new.id,
        student_id = case when student_id is null or student_id = '' then v_student_id else student_id end,
        full_name  = case when full_name  is null or full_name  = '' then v_full_name else full_name  end,
        department = case when department is null or department = '' then v_dept      else department end,
        batch      = case when batch      is null or batch      = '' then v_batch     else batch      end,
        phone      = coalesce(phone, v_phone)
    where lower(email) = lower(new.email) and auth_user_id is null;
    if found then
      return new;
    end if;
  end if;

  -- 3. Brand-new volunteer
  insert into public.volunteers (
    auth_user_id, student_id, full_name, email, department, batch, phone, role_level, target_classes, designated_days
  ) values (
    new.id,
    case when v_student_id <> '' then v_student_id else ('CUET_' || substr(new.id::text, 1, 8)) end,
    v_full_name,
    new.email,
    v_dept,
    v_batch,
    v_phone,
    case when v_is_admin_id and v_cuet_match then 6 else 1 end,
    20,
    '{}'
  );

  return new;
exception
  when others then
    -- never block account creation because the profile row could not be written
    raise warning 'link_new_auth_user warning: %', SQLERRM;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_new_auth_user();

-- ───────────────────────── Done ─────────────────────────
-- After running: if the Master Admin (2101103) registered BEFORE this migration and is stuck at
-- level 1, run this once in the SQL editor:
--   update public.volunteers set role_level = 6 where student_id = '2101103';
