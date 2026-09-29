-- PVMS migration — 2026-09-29 (decided_by attribution)
-- Run ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent). Run AFTER schema.sql and migration_2026-09-29_fixes.sql.
--
-- What this adds
--   Records WHO approved/rejected an attendance log, and when, so the Approvals
--   queue and any history view can show "Approved by <name>" instead of just a
--   status badge.

alter table public.attendance_logs
  add column if not exists decided_by_id   text,
  add column if not exists decided_by_name text,
  add column if not exists decided_at      timestamptz;

-- guard_attendance_update() already lets role >= 4 / Master Admin change any
-- column and blocks everyone else from touching anything but their own
-- out_time, so these new columns are automatically covered by that same rule —
-- no policy or trigger change needed.
