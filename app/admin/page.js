'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ShieldCheck, Check, X, Users, BookOpen } from 'lucide-react';

export default function AdminPage() {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [activities, setActivities] = useState([]);
  const router = useRouter();

  useEffect(() => {
    initAdmin();
  }, []);

  const initAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
    if (!vol || vol.role_level < 6) { router.push('/profile'); return; }
    setActiveVolunteer(vol);

    fetchPendingLogs();
    fetchVolunteers();
    fetchActivities();
  };

  const fetchPendingLogs = async () => {
    const { data } = await supabase.from('attendance_logs').select('*').eq('status', 'Pending').order('created_at', { ascending: false });
    if (data) setPendingLogs(data);
  };

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('volunteers').select('*').order('full_name');
    if (data) setVolunteers(data);
  };

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('title');
    if (data) setActivities(data);
  };

  const handleApproveLog = async (id) => {
    const { error } = await supabase.from('attendance_logs').update({ status: 'Approved' }).eq('id', id);
    if (!error) fetchPendingLogs();
  };

  const handleRejectLog = async (id) => {
    const { error } = await supabase.from('attendance_logs').update({ status: 'Rejected' }).eq('id', id);
    if (!error) fetchPendingLogs();
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '14px', borderBottom: '2px solid var(--prodip-border)' }}>
        <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={24} color="var(--prodip-crimson)" /> PVMS Master Admin Panel
        </h2>
        <span style={{ fontSize: '13px', background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '20px', fontWeight: 700 }}>System Administrator</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* PENDING ATTENDANCE APPROVALS */}
        <div className="card">
          <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={18} color="var(--prodip-crimson)" /> Pending Attendance Approvals ({pendingLogs.length})
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Volunteer</th>
                  <th style={{ padding: '10px 12px' }}>Activity</th>
                  <th style={{ padding: '10px 12px' }}>Times</th>
                  <th style={{ padding: '10px 12px' }}>Credited To</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingLogs.length > 0 ? (
                  pendingLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td style={{ padding: '12px' }}><b>{log.session_date}</b> <span style={{ fontSize: '11px', color: 'var(--prodip-muted)' }}>({log.day_of_week})</span></td>
                      <td style={{ padding: '12px' }}>{log.instructor_name} <br/><span style={{ fontSize: '11px', color: 'var(--prodip-muted)' }}>ID: {log.instructor_id}</span></td>
                      <td style={{ padding: '12px' }}>{log.activity_title}</td>
                      <td style={{ padding: '12px' }}>In: {log.in_time} | Out: {log.out_time || 'Ongoing'}</td>
                      <td style={{ padding: '12px' }}>{log.credited_to_id}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            style={{ background: 'var(--prodip-olive)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleApproveLog(log.id)}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            style={{ background: 'var(--prodip-crimson)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleRejectLog(log.id)}
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--prodip-muted)' }}>
                      No pending attendance logs requiring approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* VOLUNTEER ROSTER COUNT */}
          <div className="card">
            <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} /> Registered Volunteers ({volunteers.length})
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>All registered student volunteers across CUET batches.</p>
          </div>

          {/* ACTIVITIES COUNT */}
          <div className="card">
            <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={16} /> Active Activities ({activities.length})
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Configured teaching and social mentorship activities.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
