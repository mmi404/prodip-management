'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Bell, Check, X } from 'lucide-react';

export default function SubstituteNotificationBanner() {
  const [pendingReq, setPendingReq] = useState(null);

  useEffect(() => {
    checkRequests();
  }, []);

  const checkRequests = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: vol } = await supabase.from('volunteers').select('student_id').eq('auth_user_id', session.user.id).single();
    if (!vol) return;

    const requests = JSON.parse(localStorage.getItem('prodip_substitute_requests') || '[]');
    const forMe = requests.find(r => r.to_id === vol.student_id && r.status === 'pending');
    if (forMe) {
      setPendingReq(forMe);
    }
  };

  const handleRespond = (accepted) => {
    if (!pendingReq) return;
    const requests = JSON.parse(localStorage.getItem('prodip_substitute_requests') || '[]');
    const req = requests.find(r => r.id === pendingReq.id);
    if (req) {
      req.status = accepted ? 'accepted' : 'declined';
      req.responded_at = new Date().toISOString();
      localStorage.setItem('prodip_substitute_requests', JSON.stringify(requests));
    }
    setPendingReq(null);
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
          {pendingReq.from_name} ({pendingReq.from_id}) requested you as substitute for {pendingReq.class_date}.
          {pendingReq.note ? ` Note: ${pendingReq.note}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          style={{ background: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => handleRespond(true)}
        >
          <Check size={14} /> Accept &amp; Take Class
        </button>
        <button
          style={{ background: '#991b1b', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => handleRespond(false)}
        >
          <X size={14} /> Decline
        </button>
      </div>
    </div>
  );
}
