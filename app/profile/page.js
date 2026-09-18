'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import QuickSwitcher from '@/components/QuickSwitcher';
import SubstituteRequestBox from '@/components/SubstituteRequestBox';
import LoginModal from '@/components/LoginModal';
import { User, Award, Calendar, LogOut, Edit3, Shield, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [userRole, setUserRole] = useState({ name: 'Volunteer', level: 1 });
  const [logs, setLogs] = useState([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [phonePrivate, setPhonePrivate] = useState(false);
  const [fb, setFb] = useState('');
  const [fbPrivate, setFbPrivate] = useState(false);

  const router = useRouter();

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoginOpen(true);
      return;
    }

    const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
    if (!vol) {
      setIsLoginOpen(true);
      return;
    }

    setActiveVolunteer(vol);
    setPhone(vol.phone || '');
    setPhonePrivate(!vol.phone_is_public);
    setFb(vol.fb_profile_url || '');
    setFbPrivate(!vol.fb_is_public);

    const { data: roles } = await supabase.from('roles').select('*').eq('level', vol.role_level).single();
    if (roles) setUserRole(roles);

    const { data: appLogs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('credited_to_id', vol.student_id)
      .eq('status', 'Approved')
      .order('session_date', { ascending: false });

    if (appLogs) setLogs(appLogs);
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await supabase.auth.signOut();
    setActiveVolunteer(null);
    router.push('/');
  };

  const handleSaveProfile = async () => {
    if (!activeVolunteer) return;
    const { error } = await supabase.from('volunteers').update({
      phone: phone.trim(),
      fb_profile_url: fb.trim(),
      phone_is_public: !phonePrivate,
      fb_is_public: !fbPrivate
    }).eq('id', activeVolunteer.id);

    if (error) {
      alert('Failed to save profile: ' + error.message);
      return;
    }

    setActiveVolunteer({
      ...activeVolunteer,
      phone: phone.trim(),
      fb_profile_url: fb.trim(),
      phone_is_public: !phonePrivate,
      fb_is_public: !fbPrivate
    });
    setIsEditModalOpen(false);
  };

  if (!activeVolunteer) {
    return (
      <section>
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => router.push('/')}
          onSuccess={loadSession}
        />
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <User size={36} color="var(--prodip-navy)" style={{ margin: '0 auto 12px' }} />
          <h2>Sign in to view your Volunteer Profile</h2>
        </div>
      </section>
    );
  }

  const completedCount = logs.length;
  const target = activeVolunteer.target_classes || 20;
  const pct = Math.min(100, Math.round((completedCount / target) * 100));
  const designatedFormatted = (activeVolunteer.designated_days || []).join(', ') || 'None';

  return (
    <section>
      <QuickSwitcher />

      <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '14px', borderBottom: '2px solid var(--prodip-border)' }}>
        <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
          <User size={20} color="var(--prodip-navy)" /> Volunteer Profile &amp; Dashboard
        </h2>
        <div style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Academic Term 2026 · Active Roster</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* LEFT PROFILE CARD */}
        <div className="card">
          <div style={{ textAlign: 'center', paddingBottom: '18px', marginBottom: '18px', borderBottom: '1px solid var(--prodip-border)' }}>
            <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', display: 'flex', alignItems: 'center', justify: 'center', margin: '0 auto 12px' }}>
              <User size={38} color="var(--prodip-navy)" />
            </div>
            <div style={{ fontSize: '19px', fontWeight: 800, color: 'var(--prodip-navy)' }}>{activeVolunteer.full_name}</div>
            <div style={{ fontSize: '13px', color: 'var(--prodip-muted)', marginTop: '3px' }}>Student ID: <b>{activeVolunteer.student_id}</b></div>
            <span className="role-badge" style={{ display: 'inline-block', background: 'var(--prodip-olive)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase', marginTop: '8px' }}>
              {userRole.name}
            </span>
          </div>

          <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13.5px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>Department</span>
            <span style={{ fontWeight: 600 }}>{activeVolunteer.department || '—'}</span>
          </div>
          <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13.5px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>CUET Batch</span>
            <span style={{ fontWeight: 600 }}>{activeVolunteer.batch || '—'}</span>
          </div>
          <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13.5px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>Email</span>
            <span style={{ fontWeight: 600, fontSize: '11.5px' }}>{activeVolunteer.email || '—'}</span>
          </div>
          <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13.5px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>WhatsApp</span>
            <div>
              <span style={{ fontWeight: 600 }}>{activeVolunteer.phone || 'Not provided'} </span>
              <span className={`privacy-pill ${activeVolunteer.phone_is_public ? 'public' : 'private'}`}>
                {activeVolunteer.phone_is_public ? 'Public' : 'Private'}
              </span>
            </div>
          </div>
          <div className="data-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13.5px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>Designated Days</span>
            <span style={{ fontWeight: 700, color: 'var(--prodip-crimson)' }}>{designatedFormatted}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--prodip-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {userRole.level >= 3 && (
              <Link href="/coordinator" className="btn-panel-link coord-bg">
                <Shield size={16} color="white" /> Open Coordinator Desk
              </Link>
            )}
            {userRole.level >= 6 && (
              <Link href="/admin" className="btn-panel-link admin-bg">
                <ShieldCheck size={16} color="white" /> Open Management Panel
              </Link>
            )}
            <button className="btn-edit-profile" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--prodip-border)', background: '#f8fafc', color: 'var(--prodip-navy)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => setIsEditModalOpen(true)}>
              <Edit3 size={15} /> Edit Profile &amp; Privacy
            </button>
            <button className="btn-signout" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #fecdd3', background: '#fff1f2', color: 'var(--prodip-crimson)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={handleSignOut}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </div>

        {/* RIGHT DASHBOARD CONTENT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SUBSTITUTE REQUEST BOX */}
          <SubstituteRequestBox activeVolunteer={activeVolunteer} />

          {/* CERTIFICATE ELIGIBILITY */}
          <div className="card cert-card">
            <div className="cert-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--prodip-gold)" /> Certificate Eligibility
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Progress towards formal volunteer certification ({target} classes required)</p>
              </div>
              <span className="role-badge" style={{ background: completedCount >= target ? 'var(--prodip-olive)' : 'var(--prodip-gold)', color: completedCount >= target ? '#fff' : '#000' }}>
                {completedCount >= target ? 'Eligible for Certificate' : 'In Progress'}
              </span>
            </div>
            <div className="progress-track-wrapper" style={{ margin: '22px 0 14px' }}>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
              <span style={{ color: 'var(--prodip-navy)' }}>{completedCount} Classes Completed</span>
              <span style={{ color: 'var(--prodip-crimson)' }}>{Math.max(0, target - completedCount)} Classes Remaining ({pct}%)</span>
            </div>
          </div>

          {/* ATTENDANCE TRACKER */}
          <div className="card">
            <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={17} color="var(--prodip-olive)" /> Attendance History
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--prodip-muted)', marginBottom: '14px' }}>Approved teaching sessions logged in system.</p>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {logs.length > 0 ? (
                logs.slice(0, 7).map((log) => (
                  <div key={log.id} style={{ border: '1px solid var(--prodip-border)', borderRadius: '12px', padding: '10px', textAlign: 'center', background: '#f8fafc', minWidth: '70px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--prodip-muted)', textTransform: 'uppercase' }}>{(log.day_of_week || '').substring(0,3)}</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--prodip-text)' }}>{log.session_date ? log.session_date.substring(5) : ''}</div>
                    <div style={{ margin: '4px auto 0', width: '28px', height: '28px', borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={15} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--prodip-muted)', padding: '10px 0' }}>No approved attendance logs yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', marginBottom: '4px', fontWeight: 800 }}>Edit Profile &amp; Privacy</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '16px' }}>Update your contact information.</p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>WhatsApp Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--prodip-border)', borderRadius: '8px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Hide WhatsApp Number</span>
              <input type="checkbox" checked={phonePrivate} onChange={(e) => setPhonePrivate(e.target.checked)} />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Facebook Profile URL</label>
              <input
                type="text"
                value={fb}
                onChange={(e) => setFb(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--prodip-border)', borderRadius: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
              <button style={{ background: 'var(--prodip-navy)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }} onClick={handleSaveProfile}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
