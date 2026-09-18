'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import SubstituteRequestBox from '@/components/SubstituteRequestBox';
import QuickSwitcher from '@/components/QuickSwitcher';
import AuthGate from '@/components/AuthGate';
import { ArrowRightLeft, UserCheck, Check, Clock } from 'lucide-react';

export default function SubstitutePage() {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [requestsList, setRequestsList] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
      if (vol) setActiveVolunteer(vol);
    }
    loadRequests();
  };

  const loadRequests = () => {
    const stored = JSON.parse(localStorage.getItem('prodip_substitute_requests') || '[]');
    setRequestsList(stored);
  };

  const handleAcceptRequest = (reqId) => {
    const updated = requestsList.map(r => r.id === reqId ? { ...r, status: 'accepted' } : r);
    localStorage.setItem('prodip_substitute_requests', JSON.stringify(updated));
    setRequestsList(updated);
    alert('You have accepted this substitute class request!');
  };

  return (
    <AuthGate minRoleLevel={1} requiredRoleName="Volunteer">
      <section>
        <QuickSwitcher />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '14px', borderBottom: '2px solid var(--prodip-border)', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ArrowRightLeft size={22} color="var(--prodip-gold)" /> Substitute Teacher Requests
        </h2>
        <span style={{ fontSize: '12px', background: '#fef3c7', color: '#92400e', padding: '5px 14px', borderRadius: '20px', fontWeight: 700 }}>
          Class Duty Exchange
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* LEFT COLUMN: REQUEST FORM */}
        <div>
          {activeVolunteer ? (
            <SubstituteRequestBox activeVolunteer={activeVolunteer} />
          ) : (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--prodip-muted)' }}>
              Please sign in to request a substitute teacher.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: REQUESTS LIST */}
        <div className="card">
          <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={18} color="var(--prodip-olive)" /> Active &amp; Recent Requests ({requestsList.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requestsList.length > 0 ? (
              requestsList.map((req) => (
                <div key={req.id} style={{ border: '1px solid var(--prodip-border)', borderRadius: '10px', padding: '14px', background: req.status === 'accepted' ? '#f0fdf4' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <b style={{ fontSize: '14px', color: 'var(--prodip-navy)' }}>{req.from_name}</b>
                      <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', display: 'block' }}>Requested Substitute: <b>{req.to_name}</b></span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '12px',
                      background: req.status === 'accepted' ? '#dcfce7' : '#fef3c7',
                      color: req.status === 'accepted' ? '#166534' : '#92400e'
                    }}>
                      {req.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12.5px', color: 'var(--prodip-text)', marginBottom: '8px' }}>
                    🗓️ Date: <b>{req.class_date} ({req.class_day})</b>
                  </div>
                  {req.note && (
                    <div style={{ fontSize: '12px', color: 'var(--prodip-muted)', fontStyle: 'italic', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                      "{req.note}"
                    </div>
                  )}

                  {req.status === 'pending' && activeVolunteer && activeVolunteer.student_id === req.to_id && (
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      style={{ background: 'var(--prodip-olive)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Check size={14} /> Accept Duty
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--prodip-muted)', padding: '24px', fontSize: '13px' }}>
                No active substitute requests at the moment.
              </div>
            )}
          </div>
        </div>
      </div>
      </section>
    </AuthGate>
  );
}
