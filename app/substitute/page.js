'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import SubstituteRequestBox from '@/components/SubstituteRequestBox';
import AuthGate from '@/components/AuthGate';
import { useToast } from '@/components/Toast';
import { ArrowRightLeft, UserCheck, Check, X } from 'lucide-react';
import { notifySubstituteAccepted } from '@/lib/notifications';

const STATUS_STYLE = {
  pending: { tone: 'warning', label: 'Pending' },
  accepted: { tone: 'success', label: 'Accepted' },
  declined: { tone: 'danger', label: 'Declined' }
};

export default function SubstitutePage() {
  const { toast, ToastHost } = useToast();
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [requestsList, setRequestsList] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const vol = await fetchCurrentVolunteer(session);
    setActiveVolunteer(vol);
    loadRequests(vol);
  };

  // RLS already limits rows to requests the user sent, received, or (coordinators) all of them.
  const loadRequests = async (vol = activeVolunteer) => {
    if (!vol) return;
    const { data, error } = await supabase
      .from('substitute_requests')
      .select('*')
      .or(`from_id.eq.${vol.student_id},to_id.eq.${vol.student_id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError('');
    setRequestsList(data || []);
  };

  const respond = async (req, accepted) => {
    const { error } = await supabase
      .from('substitute_requests')
      .update({ status: accepted ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
      .eq('id', req.id);
    if (error) return toast(`Could not save: ${error.message}`, 'error');
    toast(accepted ? 'You accepted this class.' : 'Request declined.', accepted ? 'success' : 'info');

    if (accepted) {
      notifySubstituteAccepted(
        req.from_id,
        'Substitute request accepted',
        `${activeVolunteer.full_name} will cover your ${req.class_day} class on ${req.class_date}.`
      ).catch((err) => console.error('notifySubstituteAccepted failed:', err));
    }

    loadRequests();
  };

  return (
    <AuthGate minRoleLevel={1} requiredRoleName="Volunteer">
      <section>
        <ToastHost />

        <div className="page-head">
          <div className="page-head-main">
            <div className="page-head-icon" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
              <ArrowRightLeft size={21} />
            </div>
            <div>
              <h2 className="page-head-title">Substitute Teacher Requests</h2>
              <p className="page-head-subtitle">Ask another volunteer to cover your class, or answer a request sent to you.</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '20px' }}>
          <div>
            {activeVolunteer ? (
              <SubstituteRequestBox activeVolunteer={activeVolunteer} onSent={() => loadRequests()} />
            ) : (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--prodip-muted)' }}>
                Loading your profile...
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color="var(--prodip-olive)" /> My Requests ({requestsList.length})
            </h3>

            {loadError && (
              <div style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', marginBottom: '12px' }}>
                Could not load requests: {loadError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requestsList.length > 0 ? (
                requestsList.map((req) => {
                  const st = STATUS_STYLE[req.status] || STATUS_STYLE.pending;
                  const incoming = activeVolunteer && activeVolunteer.student_id === req.to_id;
                  return (
                    <div key={req.id} style={{ border: '1px solid var(--prodip-border)', borderRadius: 'var(--radius-md)', padding: '14px', background: req.status === 'accepted' ? 'var(--status-success-bg)' : 'var(--prodip-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <b style={{ fontSize: '14px', color: 'var(--prodip-navy)' }}>
                            {incoming ? `From ${req.from_name}` : `To ${req.to_name}`}
                          </b>
                          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', display: 'block' }}>
                            {incoming ? 'You are asked to cover this class' : 'You asked them to cover your class'}
                          </span>
                        </div>
                        <span className={`badge badge-${st.tone}`} style={{ flexShrink: 0 }}>{st.label}</span>
                      </div>

                      <div style={{ fontSize: '12.5px', marginBottom: '8px' }}>
                        🗓️ <b>{req.class_date}</b> ({req.class_day})
                      </div>
                      {req.note && (
                        <div style={{ fontSize: '12px', color: 'var(--prodip-muted)', fontStyle: 'italic', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                          &ldquo;{req.note}&rdquo;
                        </div>
                      )}

                      {req.status === 'pending' && incoming && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-row" onClick={() => respond(req, true)} style={{ background: 'var(--status-success-solid)', color: '#fff' }}>
                            <Check size={14} /> Accept
                          </button>
                          <button className="btn-row" onClick={() => respond(req, false)} style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)' }}>
                            <X size={14} /> Decline
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--prodip-muted)', padding: '24px', fontSize: '13px' }}>
                  No substitute requests yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
