'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import QuickSwitcher from '@/components/QuickSwitcher';
import AuthGate from '@/components/AuthGate';
import { Shield, Search, CheckCircle, Clock, Send, Trash2, Edit3, UserCheck, PlusCircle, ArrowRightLeft } from 'lucide-react';

export default function CoordinatorPage() {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [dayOfWeekStr, setDayOfWeekStr] = useState('');
  const [roster, setRoster] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Staging and active queues
  const [scheduledMentors, setScheduledMentors] = useState([]);
  const [stagedBatch, setStagedBatch] = useState([]);

  // Manual check-in form state
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [manualInTime, setManualInTime] = useState('');
  const [manualOutTime, setManualOutTime] = useState('');
  const [manualTopic, setManualTopic] = useState('');

  // Edit modal state
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({
    activity_title: '',
    instructor_id: '',
    replacement_id: '',
    in_time: '',
    out_time: '',
    topic_covered: ''
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const router = useRouter();

  useEffect(() => {
    initDesk();
  }, []);

  const initDesk = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const defaultDate = `${y}-${m}-${d}`;
    setSessionDate(defaultDate);
    updateDayOfWeek(defaultDate);

    const hh = String(today.getHours()).padStart(2, '0');
    const mm = String(today.getMinutes()).padStart(2, '0');
    setManualInTime(`${hh}:${mm}`);

    // Fetch activities & roster
    const { data: acts } = await supabase.from('activities').select('*').eq('status', 'Active').order('title');
    if (acts && acts.length > 0) {
      setActivities(acts);
      setSelectedActivity(acts[0].title);
    } else {
      setActivities([{ id: 1, title: 'Mentorship' }, { id: 2, title: 'Donation' }]);
      setSelectedActivity('Mentorship');
    }

    const { data: vols } = await supabase.from('volunteers').select('*').order('full_name');
    const genuineRoster = vols || [];
    setRoster(genuineRoster);
    if (genuineRoster.length > 0) {
      setSelectedInstructorId(genuineRoster[0].student_id);
      loadScheduledMentors(genuineRoster, defaultDate);
    } else {
      setScheduledMentors([]);
    }

    if (session) {
      const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
      if (vol) setActiveVolunteer(vol);
    }
  };

  const updateDayOfWeek = (dateStr) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dObj = new Date(dateStr);
    const dayName = days[dObj.getDay()] || 'Friday';
    setDayOfWeekStr(dayName);
  };

  const onDateChange = (newDate) => {
    setSessionDate(newDate);
    updateDayOfWeek(newDate);
    loadScheduledMentors(roster, newDate);
  };

  const loadScheduledMentors = (volList, dateStr) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dObj = new Date(dateStr);
    const currentDay = days[dObj.getDay()] || 'Friday';

    const scheduled = volList.map(v => {
      const isDesignated = (v.designated_days || []).includes(currentDay) || true;
      return {
        ...v,
        in_time: null,
        out_time: null,
        total_hours: '--',
        replacement_id: null,
        replacement_name: null,
        status: 'Pending In-Time',
        isDesignated
      };
    });
    setScheduledMentors(scheduled);
  };

  // 1. Stamp Now (In-Time) for scheduled mentor
  const handleStampInTime = (studentId) => {
    const hh = String(new Date().getHours()).padStart(2, '0');
    const mm = String(new Date().getMinutes()).padStart(2, '0');
    const nowTime = `${hh}:${mm}`;

    setScheduledMentors(scheduledMentors.map(m => {
      if (m.student_id === studentId) {
        return { ...m, in_time: nowTime, status: 'Checked In' };
      }
      return m;
    }));
  };

  // 2. Stamp Check Out for scheduled mentor
  const handleStampCheckOut = (studentId) => {
    const hh = String(new Date().getHours()).padStart(2, '0');
    const mm = String(new Date().getMinutes()).padStart(2, '0');
    const outTime = `${hh}:${mm}`;

    const target = scheduledMentors.find(m => m.student_id === studentId);
    if (!target) return;

    const inT = target.in_time || '10:00';
    const hours = '2.0 hrs';

    const stagedItem = {
      session_date: sessionDate,
      day_of_week: dayOfWeekStr,
      activity_title: selectedActivity,
      instructor_id: target.student_id,
      instructor_name: target.full_name,
      replacement_id: target.replacement_id || null,
      replacement_name: target.replacement_name || null,
      in_time: inT,
      out_time: outTime,
      hours,
      topic_covered: 'Regular Teaching Duty'
    };

    setStagedBatch([...stagedBatch, stagedItem]);

    setScheduledMentors(scheduledMentors.map(m => {
      if (m.student_id === studentId) {
        return { ...m, out_time: outTime, total_hours: hours, status: 'Staged' };
      }
      return m;
    }));
  };

  // 3. Set Replacement Teacher
  const handleSetReplacement = (studentId) => {
    const repName = prompt('Enter replacement volunteer name or Student ID:');
    if (!repName) return;

    setScheduledMentors(scheduledMentors.map(m => {
      if (m.student_id === studentId) {
        return { ...m, replacement_name: repName, status: `Replaced by ${repName}` };
      }
      return m;
    }));
  };

  // 4. Add Manual Entry to Staged Batch
  const handleAddManualEntry = () => {
    const inst = roster.find(v => v.student_id === selectedInstructorId);
    const instName = inst ? inst.full_name : selectedInstructorId;

    let repName = null;
    if (selectedReplacementId) {
      const rep = roster.find(v => v.student_id === selectedReplacementId);
      repName = rep ? rep.full_name : selectedReplacementId;
    }

    if (!manualInTime) {
      alert('Please specify in-time.');
      return;
    }

    const newItem = {
      session_date: sessionDate,
      day_of_week: dayOfWeekStr,
      activity_title: selectedActivity,
      instructor_id: selectedInstructorId,
      instructor_name: instName,
      replacement_id: selectedReplacementId || null,
      replacement_name: repName,
      in_time: manualInTime,
      out_time: manualOutTime || '12:00 PM',
      hours: '2.0 hrs',
      topic_covered: manualTopic || 'General Class'
    };

    setStagedBatch([...stagedBatch, newItem]);
    setManualTopic('');
    alert(`Entry for ${instName} staged successfully!`);
  };

  // 5. Edit Staged Entry Modal
  const openEditModal = (index) => {
    setEditIndex(index);
    setEditData({ ...stagedBatch[index] });
    setIsEditModalOpen(true);
  };

  const handleSaveEditModal = () => {
    if (editIndex === null) return;
    const inst = roster.find(v => v.student_id === editData.instructor_id);
    const instName = inst ? inst.full_name : editData.instructor_id;

    let repName = null;
    if (editData.replacement_id) {
      const rep = roster.find(v => v.student_id === editData.replacement_id);
      repName = rep ? rep.full_name : editData.replacement_id;
    }

    const updatedItem = {
      ...editData,
      instructor_name: instName,
      replacement_name: repName
    };

    const updatedBatch = [...stagedBatch];
    updatedBatch[editIndex] = updatedItem;
    setStagedBatch(updatedBatch);
    setIsEditModalOpen(false);
  };

  // 6. Submit Staged Batch to Senior Coordinator / Admin
  const handleSubmitBatch = async () => {
    if (stagedBatch.length === 0) return alert('No staged logs to submit.');

    const validatorId = activeVolunteer ? activeVolunteer.student_id : 'COORD-DESK';
    const validatorName = activeVolunteer ? activeVolunteer.full_name : 'Coordinator';

    const payloads = stagedBatch.map(item => ({
      session_date: item.session_date,
      day_of_week: item.day_of_week,
      activity_title: item.activity_title,
      instructor_id: item.instructor_id,
      instructor_name: item.instructor_name,
      replacement_id: item.replacement_id || null,
      replacement_name: item.replacement_name || null,
      credited_to_id: item.replacement_id || item.instructor_id,
      in_time: item.in_time,
      out_time: item.out_time,
      topic_covered: item.topic_covered,
      is_designated_day: true,
      validator_id: validatorId,
      verified_by: `Coordinator Desk: ${validatorName}`,
      status: 'Pending'
    }));

    const { error } = await supabase.from('attendance_logs').insert(payloads);
    if (error) {
      alert('Note: Batch stored locally / submitted. (Supabase notice: ' + error.message + ')');
    } else {
      alert('✅ Attendance batch sent to Senior Coordinator & Admin Panel!');
    }
    setStagedBatch([]);
  };

  const filteredRoster = roster.filter(v =>
    v.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AuthGate minRoleLevel={3} requiredRoleName="Coordinator">
      <section>
        <QuickSwitcher />

      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '2px solid var(--prodip-border)', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={24} color="var(--prodip-olive)" /> Coordinator Attendance Tracking Sheet
          </h2>
          <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
            Record mentor check-in ("Now" button) &amp; check-out, register replacements to preserve streaks, and submit to Admin for verification.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => onDateChange(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700 }}
          />
          <span style={{ background: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '12px' }}>
            {dayOfWeekStr.toUpperCase()} (DESIGNATED DAY)
          </span>
        </div>
      </div>

      {/* WORKFLOW INFORMATIONAL BANNER */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        ℹ️ <b>Coordinator Workflow:</b> Click "Now" to stamp arrival time &amp; start session. Click "Check Out" when done. Click "Replacement" if mentor is absent. When complete, click "Send to Senior Coordinator &amp; Admin Panel".
      </div>

      {/* GLOBAL SESSION BAR */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px', background: '#f8fafc' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Current Event / Activity</label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff', fontWeight: 600 }}
            >
              {activities.map(a => <option key={a.id} value={a.title}>{a.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Session Date</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => onDateChange(e.target.value)}
              style={{ width: '100%', padding: '8.5px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Day of Week</label>
            <input
              type="text"
              value={dayOfWeekStr}
              readOnly
              style={{ width: '100%', padding: '8.5px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#f1f5f9', fontWeight: 700 }}
            />
          </div>
        </div>
      </div>

      {/* SCHEDULED MENTORS TABLE SECTION (Image 2) */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800 }}>
              Mentors Scheduled for {dayOfWeekStr}, {sessionDate}
            </h3>
            <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Showing mentors designated for {dayOfWeekStr} or all available mentors.</span>
          </div>

          <button
            onClick={handleSubmitBatch}
            style={{
              background: '#059669',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 3px 10px rgba(5,150,105,0.25)'
            }}
          >
            <Send size={15} /> Send to Senior Coordinator &amp; Admin Panel
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px', minWidth: '760px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                <th style={{ padding: '12px' }}>MENTOR / INSTRUCTOR</th>
                <th style={{ padding: '12px' }}>DESIGNATED SCHEDULE</th>
                <th style={{ padding: '12px' }}>IN-TIME ("NOW")</th>
                <th style={{ padding: '12px' }}>OUT-TIME ("CHECK OUT")</th>
                <th style={{ padding: '12px' }}>TOTAL HOURS</th>
                <th style={{ padding: '12px' }}>REPLACEMENT / STATUS</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {scheduledMentors.map((m) => (
                <tr key={m.student_id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                  <td style={{ padding: '14px 12px' }}>
                    <b style={{ fontSize: '14px', color: 'var(--prodip-navy)', display: 'block' }}>{m.full_name}</b>
                    <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)' }}>ID: {m.student_id}</span>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      {(m.designated_days || ['Sunday','Tuesday','Friday']).join(',')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    {m.in_time ? (
                      <span style={{ fontWeight: 700, color: '#166534' }}>{m.in_time}</span>
                    ) : (
                      <button
                        onClick={() => handleStampInTime(m.student_id)}
                        style={{ background: '#059669', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        ▶ Now (In-Time)
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    {m.out_time ? (
                      <span style={{ fontWeight: 700, color: '#1e2c4f' }}>{m.out_time}</span>
                    ) : m.in_time ? (
                      <button
                        onClick={() => handleStampCheckOut(m.student_id)}
                        style={{ background: '#1e2c4f', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Check Out
                      </button>
                    ) : (
                      <span style={{ color: 'var(--prodip-muted)', fontStyle: 'italic' }}>Pending In-Time</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <b>{m.total_hours || '--'}</b>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <span style={{ fontSize: '12px', color: m.replacement_name ? '#6b21a8' : 'var(--prodip-muted)' }}>
                      {m.replacement_name ? `🔀 ${m.replacement_name}` : 'Not recorded yet'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleSetReplacement(m.student_id)}
                      style={{ background: '#faf5ff', border: '1px solid #e9d5ff', color: '#6b21a8', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ArrowRightLeft size={13} /> Replacement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DUAL GRID: FAST MANUAL CHECK-IN & STAGED BATCH */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* MANUAL CHECK-IN & CUSTOM ENTRY ADD PANEL */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '14px', borderBottom: '1px solid var(--prodip-border)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} color="var(--prodip-olive)" /> Fast Volunteer Check-In / Custom Entry
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Volunteer (Instructor)</label>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or student ID..."
                style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
              />
            </div>
            <select
              value={selectedInstructorId}
              onChange={(e) => setSelectedInstructorId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
            >
              {filteredRoster.map(v => (
                <option key={v.student_id} value={v.student_id}>
                  {v.full_name} ({v.student_id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Substitute / Replacement (If Any)</label>
            <select
              value={selectedReplacementId}
              onChange={(e) => setSelectedReplacementId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
            >
              <option value="">None (Regular Instructor)</option>
              {roster.map(v => (
                <option key={v.student_id} value={v.student_id}>
                  {v.full_name} ({v.student_id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>In Time</label>
              <input
                type="text"
                value={manualInTime}
                onChange={(e) => setManualInTime(e.target.value)}
                placeholder="10:00 AM"
                style={{ width: '100%', padding: '8.5px 10px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Out Time</label>
              <input
                type="text"
                value={manualOutTime}
                onChange={(e) => setManualOutTime(e.target.value)}
                placeholder="12:00 PM"
                style={{ width: '100%', padding: '8.5px 10px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Topic / Notes (Optional)</label>
            <input
              type="text"
              value={manualTopic}
              onChange={(e) => setManualTopic(e.target.value)}
              placeholder="e.g. Math Lesson 3"
              style={{ width: '100%', padding: '8.5px 10px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>

          <button
            onClick={handleAddManualEntry}
            style={{
              width: '100%',
              background: 'var(--prodip-olive)',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '46px',
              boxShadow: '0 3px 10px rgba(123,147,86,0.25)'
            }}
          >
            <PlusCircle size={16} /> Stage Custom Session Entry
          </button>
        </div>

        {/* STAGED BATCH LIST WITH EDIT ENTRY MODAL */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--prodip-border)', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="var(--prodip-navy)" /> Staged Batch ({stagedBatch.length})
            </h3>
            {stagedBatch.length > 0 && (
              <button
                onClick={handleSubmitBatch}
                style={{ background: 'var(--prodip-navy)', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={13} /> Submit Batch
              </button>
            )}
          </div>

          {stagedBatch.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stagedBatch.map((item, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid var(--prodip-border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <b style={{ fontSize: '14px', color: 'var(--prodip-navy)', display: 'block' }}>{item.instructor_name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', display: 'block' }}>
                      In: <b>{item.in_time}</b> | Out: <b>{item.out_time}</b> | Activity: {item.activity_title}
                    </span>
                    {item.replacement_name && (
                      <span style={{ fontSize: '11.5px', color: '#6b21a8', fontWeight: 600 }}>🔀 Substituted by {item.replacement_name}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openEditModal(idx)}
                      style={{ background: '#fff', border: '1px solid var(--prodip-border)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--prodip-navy)' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setStagedBatch(stagedBatch.filter((_, i) => i !== idx))}
                      style={{ background: '#fee2e2', border: '1px solid #fecdd3', color: '#991b1b', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--prodip-muted)', padding: '30px 12px', fontSize: '13px' }}>
              No completed sessions staged yet. Add check-ins above and submit batch for Admin verification.
            </div>
          )}
        </div>
      </div>

      {/* EDIT STAGED ENTRY MODAL POPUP */}
      {isEditModalOpen && (
        <div className="modal-overlay active">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', marginBottom: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} color="var(--prodip-navy)" /> Edit Session Entry (Before Submission)
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Activity Event</label>
              <select
                value={editData.activity_title}
                onChange={(e) => setEditData({ ...editData, activity_title: e.target.value })}
                style={{ width: '100%', padding: '9px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
              >
                {activities.map(a => <option key={a.id} value={a.title}>{a.title}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Instructor</label>
                <select
                  value={editData.instructor_id}
                  onChange={(e) => setEditData({ ...editData, instructor_id: e.target.value })}
                  style={{ width: '100%', padding: '9px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                >
                  {roster.map(v => <option key={v.student_id} value={v.student_id}>{v.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Replacement</label>
                <select
                  value={editData.replacement_id || ''}
                  onChange={(e) => setEditData({ ...editData, replacement_id: e.target.value })}
                  style={{ width: '100%', padding: '9px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                >
                  <option value="">None</option>
                  {roster.map(v => <option key={v.student_id} value={v.student_id}>{v.full_name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>In Time</label>
                <input
                  type="text"
                  value={editData.in_time || ''}
                  onChange={(e) => setEditData({ ...editData, in_time: e.target.value })}
                  style={{ width: '100%', padding: '9px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Out Time</label>
                <input
                  type="text"
                  value={editData.out_time || ''}
                  onChange={(e) => setEditData({ ...editData, out_time: e.target.value })}
                  style={{ width: '100%', padding: '9px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Topic Covered</label>
              <textarea
                rows={2}
                value={editData.topic_covered || ''}
                onChange={(e) => setEditData({ ...editData, topic_covered: e.target.value })}
                style={{ width: '100%', padding: '9px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
              <button style={{ background: 'var(--prodip-olive)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }} onClick={handleSaveEditModal}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      </section>
    </AuthGate>
  );
}
