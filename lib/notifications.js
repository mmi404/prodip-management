import { supabase } from '@/lib/supabaseClient';

export async function fetchNotifications(studentId, limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id) {
  return supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function markAllNotificationsRead(studentId) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', studentId)
    .is('read_at', null);
}

// Live updates while the tab is open — push covers the tab-closed case.
// The navbar renders NotificationBell twice at once (desktop row + mobile
// menu, CSS just hides whichever doesn't apply), so the topic must be unique
// per subscriber — two channels with the same topic collide mid-subscribe.
export function subscribeToNotifications(studentId, onInsert) {
  const topic = `notifications:${studentId}:${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${studentId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// A coordinator/admin composing a message to one recipient.
export async function sendCustomNotification(recipientId, title, body) {
  const { data, error } = await supabase.rpc('notify_user', {
    p_recipient_id: recipientId,
    p_title: title,
    p_body: body,
    p_type: 'custom'
  });
  if (error) throw error;
  return data;
}

// A coordinator/admin composing a message to several recipients (or "All").
export async function sendCustomNotificationToMany(recipientIds, title, body) {
  const { data, error } = await supabase.rpc('notify_many', {
    p_recipient_ids: recipientIds,
    p_title: title,
    p_body: body,
    p_type: 'custom'
  });
  if (error) throw error;
  return data;
}

export async function notifySubstituteAccepted(originalRequesterId, title, body) {
  const { error } = await supabase.rpc('notify_user', {
    p_recipient_id: originalRequesterId,
    p_title: title,
    p_body: body,
    p_type: 'substitute_accepted'
  });
  if (error) throw error;
}

export async function notifyMilestone(recipientId, title, body) {
  const { error } = await supabase.rpc('notify_user', {
    p_recipient_id: recipientId,
    p_title: title,
    p_body: body,
    p_type: 'milestone'
  });
  if (error) throw error;
}
