-- PVMS migration — 2026-09-29 (notifications + web push)
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent), EXCEPT the vault secret step below section 0,
-- which you only run once (re-running it is harmless but pointless).
-- Run AFTER schema.sql, migration_2026-09-29_fixes.sql and migration_2026-09-29_decided_by.sql.
--
-- What this adds
--   1. An in-app notification inbox (public.notifications) — a bell icon in the
--      navbar, readable in real time, mark-as-read.
--   2. Real browser push (public.push_subscriptions) — notifications arrive even
--      when the site tab is closed, via a Supabase Edge Function + VAPID.
--   3. public.notify_user() / notify_many() — the ONLY way rows get into
--      `notifications`. They run as SECURITY DEFINER so they can enforce who is
--      allowed to notify whom, then fire-and-forget an HTTP call (pg_net) to the
--      `send-push` Edge Function so the browser push actually goes out.
--   4. A daily cron job that calls the `send-daily-reminders` Edge Function for
--      day-of-class reminders.
--
-- BEFORE running this file:
--   a. Deploy the two Edge Functions in supabase/functions/ (see their own
--      comments for the exact `supabase functions deploy` / `supabase secrets
--      set` commands — this needs the VAPID keys and is a one-time setup step).
--   b. Run this ONE line by itself first, in its own query, with your real
--      service_role key from Project Settings → API pasted in place of the
--      placeholder (keep the quotes):
--        select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
--      It's a one-time step — if you run it again later you'll get a duplicate
--      key error, which just means it's already stored; ignore it.
--
-- NOTE ON $$ IN THIS FILE: every function body below is delimited with a named
-- tag like $svc$...$svc$ instead of a bare $$...$$. Some copy/paste paths (chat
-- clients, note apps, anything that treats $$ as a Markdown/LaTeX math marker)
-- silently eat a bare "$$", which breaks the SQL in a confusing way ("syntax
-- error near declare/perform"). Named tags don't look like that marker, so they
-- survive. If you ever add to this file, keep using named tags, not bare $$.

-- ───────────────────────── 0. VAULT SECRET READER ─────────────────────────
-- pg_net needs an Authorization header to call our Edge Functions. We read the
-- service_role key you stored above back out inside SECURITY DEFINER functions
-- only (never exposed to normal client queries).
create extension if not exists pg_net;

create or replace function public._service_role_key()
returns text language sql stable security definer set search_path = public, vault as $svc$
  select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1;
$svc$;

-- The two Edge Function URLs — same project, so this is just the project ref
-- from your existing SUPABASE_URL (lib/supabaseClient.js).
create or replace function public._functions_base_url()
returns text language sql immutable as $base$
  select 'https://pgfkliimocgalzctnded.supabase.co/functions/v1';
$base$;

-- ───────────────────────── 1. TABLES ─────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  student_id text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_student_idx on public.push_subscriptions (student_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all
  using (student_id = public.current_student_id())
  with check (student_id = public.current_student_id());

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   text not null,
  sender_id      text,
  sender_name    text,
  title          text not null,
  body           text not null,
  type           text not null default 'info' check (type in ('info', 'custom', 'substitute_accepted', 'milestone', 'reminder')),
  link           text,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (recipient_id = public.current_student_id());

-- No direct insert policy on purpose — every row is created by notify_user()/
-- notify_many() (SECURITY DEFINER, bypasses RLS) or by an Edge Function using
-- the service role key. This is what lets notify_user() enforce "who can
-- notify whom" in one place instead of a hard-to-audit RLS expression.
drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications for update
  using (recipient_id = public.current_student_id())
  with check (recipient_id = public.current_student_id());

create or replace function public.guard_notification_mark_read()
returns trigger language plpgsql security definer set search_path = public as $guard$
begin
  if new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.type is distinct from old.type
     or new.link is distinct from old.link
     or new.recipient_id is distinct from old.recipient_id
     or new.sender_id is distinct from old.sender_id
     or new.sender_name is distinct from old.sender_name
  then
    raise exception 'Only read_at can be changed on a notification.';
  end if;
  return new;
end;
$guard$;
drop trigger if exists guard_notification_mark_read on public.notifications;
create trigger guard_notification_mark_read
  before update on public.notifications
  for each row execute function public.guard_notification_mark_read();

-- ───────────────────────── 2. SEND (the only way into `notifications`) ─────────────────────────
-- Fires the push Edge Function asynchronously (pg_net is fire-and-forget from
-- SQL's point of view) so a slow/unreachable push service never blocks the
-- caller's request.
create or replace function public._fire_push(p_recipient_id text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $push$
begin
  perform net.http_post(
    url := public._functions_base_url() || '/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || public._service_role_key()),
    body := jsonb_build_object('recipient_id', p_recipient_id, 'title', p_title, 'body', p_body, 'link', p_link)
  );
exception
  when others then
    -- Never let a push-delivery hiccup fail the notification itself.
    raise warning '_fire_push warning: %', SQLERRM;
end;
$push$;

-- p_type governs who is allowed to notify whom:
--   'custom'              — caller must be Master Admin, or a strictly higher
--                            role_level than the recipient (coordinators message
--                            volunteers below them; admins message anyone).
--   'substitute_accepted'  — caller must hold an 'accepted' substitute_requests
--                            row for that (from_id = recipient, to_id = caller).
--   'milestone'            — caller must be an approver (role_level >= 4 or
--                            Master Admin); the exact 50%/100% math is computed
--                            by the approvals page right before calling this.
--   'info' / 'reminder'    — reserved for service-role callers (Edge Functions),
--                            never reachable through this RPC as a normal user.
create or replace function public.notify_user(p_recipient_id text, p_title text, p_body text, p_type text, p_link text default null)
returns uuid language plpgsql security definer set search_path = public as $notify$
declare
  v_sender_id   text := public.current_student_id();
  v_sender_name text;
  v_recipient_role int;
  v_new_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Not signed in.';
  end if;

  if p_type = 'custom' then
    select role_level into v_recipient_role from public.volunteers where student_id = p_recipient_id;
    if not (public.is_master_admin() or public.current_role_level() > coalesce(v_recipient_role, 999)) then
      raise exception 'You can only message volunteers at a lower role level than your own.';
    end if;

  elsif p_type = 'substitute_accepted' then
    if not exists (
      select 1 from public.substitute_requests
      where to_id = v_sender_id and from_id = p_recipient_id and status = 'accepted'
    ) then
      raise exception 'No accepted substitute request between you and that volunteer.';
    end if;

  elsif p_type = 'milestone' then
    if not (public.current_role_level() >= 4 or public.is_master_admin()) then
      raise exception 'Only an approver can send a milestone notification.';
    end if;

  else
    raise exception 'Unsupported notification type for this call: %', p_type;
  end if;

  select full_name into v_sender_name from public.volunteers where student_id = v_sender_id;

  insert into public.notifications (recipient_id, sender_id, sender_name, title, body, type, link)
  values (p_recipient_id, v_sender_id, v_sender_name, p_title, p_body, p_type, p_link)
  returning id into v_new_id;

  perform public._fire_push(p_recipient_id, p_title, p_body, p_link);
  return v_new_id;
end;
$notify$;

-- One bad recipient (e.g. a role_level tie) must not sink the rest of the
-- batch, so each send is isolated in its own sub-transaction via EXCEPTION.
create or replace function public.notify_many(p_recipient_ids text[], p_title text, p_body text, p_type text, p_link text default null)
returns int language plpgsql security definer set search_path = public as $many$
declare
  v_id text;
  v_count int := 0;
begin
  foreach v_id in array p_recipient_ids loop
    begin
      perform public.notify_user(v_id, p_title, p_body, p_type, p_link);
      v_count := v_count + 1;
    exception
      when others then
        raise warning 'notify_many: skipped %: %', v_id, SQLERRM;
    end;
  end loop;
  return v_count;
end;
$many$;

-- ───────────────────────── 3. DAILY CLASS-DAY REMINDERS (cron) ─────────────────────────
-- 01:00 UTC = 07:00 Asia/Dhaka. The Edge Function itself resolves "today" and
-- each volunteer's designated_days, and both inserts the reminder row and
-- sends the push directly with the service role key (no RPC round-trip needed
-- since it already runs with full access).
create extension if not exists pg_cron;

do $unsched$
begin
  if exists (select 1 from cron.job where jobname = 'daily-class-reminders') then
    perform cron.unschedule('daily-class-reminders');
  end if;
end $unsched$;

select cron.schedule(
  'daily-class-reminders',
  '0 1 * * *',
  $cronbody$
  select net.http_post(
    url := public._functions_base_url() || '/send-daily-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || public._service_role_key())
  );
  $cronbody$
);

-- ───────────────────────── Done ─────────────────────────
-- After running: sign in and click "Enable Notifications" to create your own
-- push_subscriptions row, then ask someone else to send you a custom message
-- from the Coordinator/Admin notification panel to confirm push delivery works.
