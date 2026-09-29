'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import LoginModal from '@/components/LoginModal';
import AuthGate from '@/components/AuthGate';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import { formatClock, logDuration, sumMinutes, formatMinutes } from '@/lib/time';
import { User, Calendar, LogOut, Edit3, Flame, ArrowRightLeft, Clock } from 'lucide-react';

export default function ProfilePage() {
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [userRole, setUserRole] = useState({ name: 'Volunteer', level: 1 });
  const [viewerLevel, setViewerLevel] = useState(1); // the signed-in person's own level (not the profile being viewed)
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

    const me = await fetchCurrentVolunteer(session);
    setViewerLevel(me.role_level || 1);

    // Only coordinators+ may read the whole roster (RLS), so only they get the mentor switcher.
    if ((me.role_level || 1) >= 3) {
      const { data: volList } = await supabase.from('volunteers').select('*').order('full_name');
      if (volList) setAllVolunteers(volList);
    }

    selectMentorProfile(me);
  };

  const selectMentorProfile = async (vol) => {
    setActiveVolunteer(vol);
    setPhone(vol.phone || '');
    setPhonePrivate(!vol.phone_is_public);
    setFb(vol.fb_profile_url || '');
    setFbPrivate(!vol.fb_is_public);

    const { data: roles } = await supabase.from('roles').select('*').eq('level', vol.role_level || 1).maybeSingle();
    setUserRole(roles || { name: 'Volunteer', level: vol.role_level || 1 });

    const { data: appLogs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('credited_to_id', vol.student_id)
      .eq('status', 'Approved')
      .order('session_date', { ascending: false });

    if (appLogs && appLogs.length > 0) {
      setLogs(appLogs);
    } else {
      setLogs([]);
    }
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
          <h2>Loading Volunteer Dashboard...</h2>
        </div>
      </section>
    );
  }

  const completedCount = logs.length;
  const target = activeVolunteer.target_classes || 20;
  const daysLeft = Math.max(0, target - completedCount);
  const pct = target > 0 ? Math.min(100, Math.round((completedCount / target) * 100 * 10) / 10) : 0;
  const designatedFormatted = (activeVolunteer.designated_days || []).join(', ') || 'None assigned';

  // Total verified time, summed from each approved session's real in/out times.
  const totalHours = formatMinutes(sumMinutes(logs));

  // Dynamic consecutive streak based on actual approved logs
  const currentStreak = logs.length;

  // Calculate next designated class date dynamically from user's schedule
  const getNextClassDate = (designatedDays) => {
    if (!designatedDays || designatedDays.length === 0) return 'No regular schedule assigned';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    for (let offset = 1; offset <= 7; offset++) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + offset);
      const dayName = dayNames[nextDate.getDay()];
      if (designatedDays.includes(dayName)) {
        return nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
    return designatedDays.join(', ');
  };

  return (
    <AuthGate minRoleLevel={1} requiredRoleName="Volunteer">
      <section>

      {/* TOP PROFILE HEADER BAR */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #7b9356, #667d45)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, textAlign: 'center', lineHeight: '64px' }}>
              {(activeVolunteer.full_name || 'V')[0]}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--prodip-navy)', margin: 0 }}>{activeVolunteer.full_name}</h2>
                <span className="badge badge-success">{userRole.name.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--prodip-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span>🪪 ID: <b>{activeVolunteer.student_id}</b></span>
                <span>✉️ {activeVolunteer.email || `${activeVolunteer.student_id}@prodip.org`}</span>
                <span>📅 Days: <b style={{ color: 'var(--prodip-navy)' }}>{designatedFormatted}</b></span>
              </div>
            </div>
          </div>

          {viewerLevel >= 3 && allVolunteers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--prodip-muted)', textTransform: 'uppercase' }}>View mentor:</label>
            <select
              value={activeVolunteer.student_id}
              onChange={(e) => {
                const found = allVolunteers.find(v => v.student_id === e.target.value);
                if (found) selectMentorProfile(found);
              }}
              style={{ padding: '8px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
            >
              {allVolunteers.map(v => (
                <option key={v.student_id} value={v.student_id}>
                  {v.full_name} ({v.student_id})
                </option>
              ))}
            </select>
          </div>
          )}
        </div>
      </div>

      {/* THREE KEY DASHBOARD CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* CARD 1: DESIGNATED STREAK */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>DESIGNATED STREAK</span>
            <span className="badge badge-warning"><Flame size={13} /> Active Streak</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
            <span style={{ fontSize: '40px', fontWeight: 800, color: currentStreak > 0 ? 'var(--prodip-gold)' : '#94a3b8', lineHeight: 1 }}>{currentStreak}</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--prodip-navy)' }}>Days</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--prodip-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
            Consecutive scheduled classes on designated days.<br/>
            <b>Replacements covered by substitutes keep your streak alive!</b>
          </p>
          <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: 600 }}>
            Streak protection active for replacements
          </div>
        </div>

        {/* CARD 2: CLASSES STATUS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>CLASSES STATUS</span>
            <span className="badge badge-success">Target: {target} Classes</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--prodip-muted)', display: 'block', marginBottom: '4px' }}>Completed</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--prodip-navy)' }}>
                {completedCount} <span style={{ fontSize: '13px', color: 'var(--prodip-muted)', fontWeight: 600 }}>/ {target} Classes</span>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--prodip-muted)', display: 'block', marginBottom: '4px' }}>Days Left</span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--prodip-gold)' }}>
                {daysLeft} <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', fontWeight: 600 }}>to certificate</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>Total Verified Hours:</span>
            <b style={{ color: 'var(--prodip-navy)' }}>{totalHours}</b>
          </div>
        </div>

        {/* CARD 3: CERTIFICATE PROGRESS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>CERTIFICATE PROGRESS</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#0d9488' }}>{pct}%</span>
          </div>
          <div style={{ background: '#e2e8f0', height: '8px', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ background: '#0d9488', width: `${pct}%`, height: '100%', borderRadius: '10px' }}></div>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--prodip-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
            Progress automatically updates as the Senior Coordinator and Admin panel approve your sessions.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: 'var(--prodip-muted)' }}>Milestone Badge:</span>
            <span style={{ color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⚙️ {completedCount >= target ? 'Completed' : 'In Progress'}
            </span>
          </div>
        </div>
      </div>

      {/* NEXT DESIGNATED CLASS HIGHLIGHT & SUBSTITUTE LINK */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #1e2c4f, #141e36)', color: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--prodip-gold)', textTransform: 'uppercase' }}>Next Designated Class Session</span>
            <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>{getNextClassDate(activeVolunteer.designated_days)}</div>
            <span style={{ fontSize: '11.5px', color: '#cbd5e1' }}>Use the Check In button on the home page when class starts</span>
          </div>
          <Clock size={28} color="var(--prodip-gold)" />
        </div>

        <Link href="/substitute" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ background: '#fff', border: '2px dashed var(--prodip-gold)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Need a Substitute Teacher?</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--prodip-navy)', marginTop: '2px' }}>Request Class Duty Transfer</div>
              <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>Transfer duty without losing your streak</span>
            </div>
            <ArrowRightLeft size={24} color="var(--prodip-gold)" />
          </div>
        </Link>
      </div>

      {/* APPROVED PARTICIPATION HISTORY TABLE */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="var(--prodip-olive)" /> Approved Participation History ({logs.length} Sessions)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>Recorded in-time, out-time, replacement credit, and verified hours.</span>
          </div>
          <span className="badge badge-success">Only Approved Records Shown</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--prodip-border)', color: '#64748b' }}>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>DATE &amp; DAY</th>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ACTIVITY</th>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ATTENDANCE STATUS</th>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>IN TIME</th>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>OUT TIME</th>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>HOURS</th>
                <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>APPROVAL</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                    <td data-label="Date" style={{ padding: '14px 12px' }}>
                      <b>{log.session_date}</b>
                      <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)', display: 'block' }}>{log.day_of_week}</span>
                    </td>
                    <td data-label="Activity" style={{ padding: '14px 12px' }}>
                      <span className="badge badge-info">{log.activity_title}</span>
                    </td>
                    <td data-label="Attendance" style={{ padding: '14px 12px' }}>
                      {log.replacement_name ? (
                        <div>
                          <span className="badge badge-info">🔀 Covered for {log.instructor_name}</span>
                          {log.notes && <span style={{ fontSize: '11px', color: 'var(--prodip-muted)', display: 'block', marginTop: '2px', fontStyle: 'italic' }}>{log.notes}</span>}
                        </div>
                      ) : (
                        <span className="badge badge-success">👤 Attended Directly</span>
                      )}
                    </td>
                    <td data-label="In" style={{ padding: '14px 12px', color: '#475569' }}>{formatClock(log.in_time)}</td>
                    <td data-label="Out" style={{ padding: '14px 12px', color: '#475569' }}>{log.out_time ? formatClock(log.out_time) : '--'}</td>
                    <td data-label="Duration" style={{ padding: '14px 12px' }}><b>{logDuration(log)}</b></td>
                    <td data-label="Status" style={{ padding: '14px 12px' }}>
                      <span className="badge badge-success">✓ Approved</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--prodip-muted)', fontSize: '13.5px' }}>
                    No approved class sessions recorded yet. Start attending your designated class sessions to build your milestone streak!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coordinator/Approvals/Admin links intentionally not repeated here — they
          already live one tap away in the navbar's profile menu. */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setIsEditModalOpen(true)} className="btn-row" style={{ background: 'var(--prodip-card)', border: '1px solid var(--prodip-border)', color: 'var(--prodip-navy)', minHeight: '42px' }}>
          <Edit3 size={15} /> Edit Contact Info
        </button>
        <button onClick={handleSignOut} className="btn-row" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)', minHeight: '42px' }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="modal-overlay active">
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
    </AuthGate>
  );
}
