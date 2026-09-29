'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import { localDateStr } from '@/lib/time';
import { Bell, Check, X } from 'lucide-react';

export default function SubstituteNotificationBanner() {
  const [pendingReq, setPendingReq] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkRequests();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkRequests());
    return () => subscription.unsubscribe();
  }, []);

  const checkRequests = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPendingReq(null);
      return;
    }

    const vol = await fetchCurrentVolunteer(session);
    if (!vol) return;

    const { data } = await supabase
      .from('substitute_requests')
      .select('*')
      .eq('to_id', vol.student_id)
      .eq('status', 'pending')
      .gte('class_date', localDateStr())
      .order('class_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    setPendingReq(data || null);
  };

  const handleRespond = async (accepted) => {
    if (!pendingReq || busy) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase
      .from('substitute_requests')
      .update({ status: accepted ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
      .eq('id', pendingReq.id);
    setBusy(false);

    if (err) {
      setError(`Could not save your answer: ${err.message}`);
      return;
    }
    setPendingReq(null);
    checkRequests(); // there may be another pending request queued behind this one
  };

  if (!pendingReq) return null;

  return (
    <div style={{
      background: '#fef3c7',
      border: '1px solid #fde68a',
      color: '#92400e',
      padding: '14px 18px',
      borderRadius: '14px',
      marginBottom: '20px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '10px'
    }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <b style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', marginBottom: '2px' }}>
          <Bell size={16} /> Substitute Request Received
        </b>
        <span>
          {pendingReq.from_name} ({pendingReq.from_id}) asked you to cover the class on <b>{pendingReq.class_date}</b>.
          {pendingReq.note ? ` Note: ${pendingReq.note}` : ''}
        </span>
        {error && <div style={{ color: '#991b1b', fontWeight: 700, marginTop: '4px' }}>{error}</div>}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          disabled={busy}
          style={{ background: '#166534', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '42px' }}
          onClick={() => handleRespond(true)}
        >
          <Check size={14} /> Accept
        </button>
        <button
          disabled={busy}
          style={{ background: '#991b1b', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '42px' }}
          onClick={() => handleRespond(false)}
        >
          <X size={14} /> Decline
        </button>
      </div>
    </div>
  );
}
