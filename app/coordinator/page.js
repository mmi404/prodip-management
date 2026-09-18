'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import QuickSwitcher from '@/components/QuickSwitcher';
import { Shield, Search, CheckCircle, Clock, Send, Trash2 } from 'lucide-react';

export default function CoordinatorPage() {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [roster, setRoster] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQueue, setActiveQueue] = useState([]);
  const [stagedBatch, setStagedBatch] = useState([]);
  const router = useRouter();

  useEffect(() => {
    initDesk();
  }, []);

  const initDesk = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
    if (!vol || vol.role_level < 3) { router.push('/profile'); return; }
    setActiveVolunteer(vol);

    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    setSessionDate(`${y}-${m}-${d}`);

    const { data: acts } = await supabase.from('activities').select('*').eq('status', 'Active').order('title');
    if (acts && acts.length > 0) {
      setActivities(acts);
      setSelectedActivity(acts[0].title);
    }

    const { data: vols } = await supabase.from('volunteers').select('*').order('full_name');
    if (vols) setRoster(vols);
  };

  const handleCheckInVolunteer = (vol) => {
    const hh = String(new Date().getHours()).padStart(2, '0');
    const mm = String(new Date().getMinutes()).padStart(2, '0');
    const inTime = `${hh}:${mm}`;

    const existsInQueue = activeQueue.find(q => q.student_id === vol.student_id);
    if (existsInQueue) return alert(`${vol.full_name} is already checked in.`);

    const newItem = {
      student_id: vol.student_id,
      full_name: vol.full_name,
      in_time: inTime,
      out_time: null,
      replacement_id: null,
      replacement_name: null
    };

    setActiveQueue([...activeQueue, newItem]);
  };

  const handleCheckOutVolunteer = (studentId) => {
    const hh = String(new Date().getHours()).padStart(2, '0');
    const mm = String(new Date().getMinutes()).padStart(2, '0');
    const outTime = `${hh}:${mm}`;

    const target = activeQueue.find(q => q.student_id === studentId);
    if (!target) return;

    const stagedItem = {
      ...target,
      out_time: outTime,
      session_date: sessionDate,
      activity_title: selectedActivity
    };

    setStagedBatch([...stagedBatch, stagedItem]);
    setActiveQueue(activeQueue.filter(q => q.student_id !== studentId));
  };

  const handleSubmitBatch = async () => {
    if (stagedBatch.length === 0) return alert('No staged logs to submit.');

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dObj = new Date(sessionDate);
    const dayOfWeek = dayNames[dObj.getDay()] || 'Sunday';

    const payloads = stagedBatch.map(item => ({
      session_date: sessionDate,
      day_of_week: dayOfWeek,
      activity_title: selectedActivity,
      instructor_id: item.student_id,
      instructor_name: item.full_name,
      replacement_id: item.replacement_id || null,
      replacement_name: item.replacement_name || null,
      credited_to_id: item.replacement_id || item.student_id,
      in_time: item.in_time,
      out_time: item.out_time,
      topic_covered: null,
      is_designated_day: true,
      validator_id: activeVolunteer.student_id,
      verified_by: `Coordinator Desk: ${activeVolunteer.full_name} (${activeVolunteer.student_id})`,
      status: 'Pending'
    }));

    const { error } = await supabase.from('attendance_logs').insert(payloads);
    if (error) {
      alert('Failed to submit batch: ' + error.message);
      return;
    }

    alert('Attendance batch submitted successfully for Master Admin approval!');
    setStagedBatch([]);
  };

  const filteredRoster = roster.filter(v =>
    v.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section>
      <QuickSwitcher />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '14px', borderBottom: '2px solid var(--prodip-border)' }}>
        <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={22} color="var(--prodip-olive)" /> Coordinator Attendance Desk
        </h2>
        <span style={{ fontSize: '13px', background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontWeight: 700 }}>Active Desk</span>
      </div>

      {/* SESSION HEADER */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #1e2c4f, #141e36)', color: 'white' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--prodip-gold)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Activity Event</label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            >
              {activities.map(a => <option key={a.id} value={a.title} style={{ color: '#000' }}>{a.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--prodip-gold)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Session Date</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* ROSTER SEARCH & QUICK CHECK-IN */}
        <div className="card">
          <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '12px' }}>Volunteer Roster &amp; Quick Check-In</h3>
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or Student ID..."
              style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px' }}
            />
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredRoster.map(v => (
              <div key={v.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', background: '#f8fafc' }}>
                <div>
                  <b style={{ fontSize: '13.5px', display: 'block' }}>{v.full_name}</b>
                  <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)' }}>ID: {v.student_id} · {v.department || ''}</span>
                </div>
                <button
                  style={{ background: 'var(--prodip-olive)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => handleCheckInVolunteer(v)}
                >
                  + Check In
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVE QUEUE & STAGED BATCH */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ACTIVE QUEUE */}
          <div className="card">
            <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--prodip-olive)" /> Active Queue ({activeQueue.length})
            </h3>
            {activeQueue.length > 0 ? (
              activeQueue.map(q => (
                <div key={q.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '8px', marginBottom: '8px' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: '#166534', display: 'block' }}>{q.full_name}</b>
                    <span style={{ fontSize: '11.5px', color: '#15803d' }}>Checked in at {q.in_time}</span>
                  </div>
                  <button
                    style={{ background: 'var(--prodip-crimson)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => handleCheckOutVolunteer(q.student_id)}
                  >
                    Check Out
                  </button>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--prodip-muted)', textAlign: 'center', padding: '16px 0' }}>No active volunteers checked in yet.</div>
            )}
          </div>

          {/* STAGED BATCH SUBMISSION */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} color="var(--prodip-navy)" /> Staged Batch ({stagedBatch.length})
              </h3>
              {stagedBatch.length > 0 && (
                <button
                  style={{ background: 'var(--prodip-navy)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleSubmitBatch}
                >
                  <Send size={13} /> Submit Batch
                </button>
              )}
            </div>
            {stagedBatch.length > 0 ? (
              stagedBatch.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', marginBottom: '8px', background: '#f8fafc' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', display: 'block' }}>{s.full_name}</b>
                    <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)' }}>In: {s.in_time} | Out: {s.out_time}</span>
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                    onClick={() => setStagedBatch(stagedBatch.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--prodip-muted)', textAlign: 'center', padding: '16px 0' }}>No logs staged for submission.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
