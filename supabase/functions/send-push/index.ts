// Supabase Edge Function: send-push
//
// Called by public._fire_push() (see supabase/migration_2026-09-29_notifications.sql)
// right after a row is written to public.notifications. Looks up every browser
// subscription the recipient has registered and sends a real Web Push message to
// each, so the notification shows up even if the site tab is closed.
//
// Deploy:
//   supabase functions deploy send-push
// One-time secrets (the private key must never reach the browser bundle):
//   supabase secrets set VAPID_PUBLIC_KEY=<from `npx web-push generate-vapid-keys`>
//   supabase secrets set VAPID_PRIVATE_KEY=<same output, private key>
//   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically for
// every Edge Function — no need to set those.

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

Deno.serve(async (req) => {
  try {
    const { recipient_id, title, body, link } = await req.json();
    if (!recipient_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'recipient_id, title and body are required' }), { status: 400 });
    }

    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('student_id', recipient_id);

    if (error) throw error;

    const payload = JSON.stringify({ title, body, link: link || '/' });
    let sent = 0;

    await Promise.all(
      (subs || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err) {
          // 404/410 = the browser dropped this subscription (uninstalled, cleared
          // data, expired) — stop trying to reach it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          } else {
            console.error('send-push: delivery failed for', sub.id, err?.message || err);
          }
        }
      })
    );

    return new Response(JSON.stringify({ ok: true, sent, subscriptions: (subs || []).length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
});
