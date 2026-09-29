import { supabase } from '@/lib/supabaseClient';

// Resolve the roster row for the signed-in auth user.
// 1) linked by auth_user_id  2) matched by email  3) synthetic level-1 placeholder (unlinked: true)
// maybeSingle() is used so "no row" returns null instead of a 406 error in the console.
export async function fetchCurrentVolunteer(session) {
  if (!session) return null;

  const { data: linked } = await supabase
    .from('volunteers')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();
  if (linked) return linked;

  if (session.user.email) {
    const { data: byEmail } = await supabase
      .from('volunteers')
      .select('*')
      .ilike('email', session.user.email)
      .maybeSingle();
    if (byEmail) return byEmail;
  }

  const meta = session.user.user_metadata || {};
  const fallbackName = session.user.email?.split('@')[0] || 'Volunteer';
  return {
    student_id: meta.student_id || fallbackName,
    full_name: meta.full_name || fallbackName,
    email: session.user.email,
    role_level: 1,
    designated_days: [],
    target_classes: 20,
    unlinked: true
  };
}
