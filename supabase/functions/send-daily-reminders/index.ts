// Supabase Edge Function: send-daily-reminders
//
// Called once a day by the `daily-class-reminders` pg_cron job (see
// supabase/migration_2026-09-29_notifications.sql, section 3) at 01:00 UTC
// (07:00 Asia/Dhaka). For every volunteer whose designated_days includes
// today, writes a `reminder` row to public.notifications and pushes it to
// their registered devices.
//
// Deploy: supabase functions deploy send-daily-reminders
// Uses the same VAPID_* secrets as send-push (see that function's header).

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6, no DST

function todayInDhaka() {
  const dhakaNow = new Date(Date.now() + DHAKA_OFFSET_MS);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { dayName: dayNames[dhakaNow.getUTCDay()], dateStr: dhakaNow.toISOString().slice(0, 10) };
}

async function pushTo(studentId: string, title: string, body: string, link: string) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('student_id', studentId);

  const payload = JSON.stringify({ title, body, link });
  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    })
  );
}

Deno.serve(async () => {
  try {
    const { dayName, dateStr } = todayInDhaka();

    const { data: volunteers, error } = await supabaseAdmin
      .from('volunteers')
      .select('student_id, full_name, designated_days')
      .contains('designated_days', [dayName]);
    if (error) throw error;

    let sent = 0;
    for (const v of volunteers || []) {
      // Idempotent: skip if today's reminder already went out (e.g. cron re-run).
      const { data: existing } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('recipient_id', v.student_id)
        .eq('type', 'reminder')
        .gte('created_at', `${dateStr}T00:00:00Z`)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const title = `Class today — ${dayName}`;
      const body = `${v.full_name}, you're scheduled to teach today. Don't forget to check in.`;
      await supabaseAdmin.from('notifications').insert({
        recipient_id: v.student_id,
        sender_id: null,
        sender_name: 'PVMS',
        title,
        body,
        type: 'reminder',
        link: '/'
      });
      await pushTo(v.student_id, title, body, '/');
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, day: dayName, remindersSent: sent }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('send-daily-reminders error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
});
