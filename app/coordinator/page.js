'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthGate from '@/components/AuthGate';
import { useToast } from '@/components/Toast';
import {
  calcHours,
  durationMinutes,
  formatClock,
  formatToTimeInput,
  nowHHMM,
  localDateStr,
  dayNameOf
} from '@/lib/time';
import { Shield, Search, CheckCircle, Send, Trash2, Edit3, PlusCircle, ArrowRightLeft, Undo2, Bell } from 'lucide-react';
import { sendCustomNotificationToMany } from '@/lib/notifications';

const labelStyle = { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '14px', background: '#fff' };

const draftKey = (date) => `prodip_coord_draft_${date}`;

export default function CoordinatorPage() {
  const { toast, ToastHost } = useToast();

  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [roster, setRoster] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllMentors, setShowAllMentors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Per-mentor live state for the schedule table: { [student_id]: { in_time, out_time, replacement_id, replacement_name, staged } }
  const [sessions, setSessions] = useState({});
  const [stagedBatch, setStagedBatch] = useState([]);
  // Sessions already saved in the DB for the chosen date. A mentor can legitimately
  // teach more than one class the same day, so this is informational (a badge) and
  // for exact-duplicate protection only — it never blocks a new, distinct session.
  const [submittedLogs, setSubmittedLogs] = useState([]);

  // Manual check-in form state
  const [selectedInstructorId, setSelectedInstructorId] = useState('');
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [manualInTime, setManualInTime] = useState('');
  const [manualOutTime, setManualOutTime] = useState('');
  const [manualTopic, setManualTopic] = useState('');

  // Edit modal state
  const [editIndex, setEditIndex] = useState(null);
  const [editData, setEditData] = useState({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Replacement picker modal
  const [replacementFor, setReplacementFor] = useState(null); // student_id
  const [replacementPick, setReplacementPick] = useState('');

  // Send Notification panel
  const [notifAudience, setNotifAudience] = useState('pick'); // 'pick' | 'all'
  const [notifRecipients, setNotifRecipients] = useState([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  const dayOfWeekStr = dayNameOf(sessionDate);

  useEffect(() => {
    initDesk();
  }, []);

  const initDesk = async () => {
    const today = localDateStr();
    setSessionDate(today);
    setManualInTime(nowHHMM());

    const { data: { session } } = await supabase.auth.getSession();

    const [{ data: acts }, { data: vols }] = await Promise.all([
      supabase.from('activities').select('*').eq('status', 'Active').order('title'),
      supabase.from('volunteers').select('*').order('full_name')
    ]);

    setActivities(acts || []);
    if (acts && acts.length > 0) setSelectedActivity(acts[0].title);

    const list = vols || [];
    setRoster(list);
    if (list.length > 0) setSelectedInstructorId(list[0].student_id);

    if (session) {
      const mine = list.find((v) => v.auth_user_id === session.user.id);
      if (mine) setActiveVolunteer(mine);
    }

    restoreDraft(today);
    await loadSubmitted(today);
    setLoading(false);
  };

  // Keep the day's in-progress sheet across refreshes / accidental tab closes.
  const restoreDraft = (date) => {
    try {
      const raw = localStorage.getItem(draftKey(date));
      if (raw) {
        const parsed = JSON.parse(raw);
        setSessions(parsed.sessions || {});
        setStagedBatch(parsed.stagedBatch || []);
        return;
      }
    } catch (e) {}
    setSessions({});
    setStagedBatch([]);
  };

  useEffect(() => {
    if (!sessionDate || loading) return;
    try {
      if (Object.keys(sessions).length === 0 && stagedBatch.length === 0) {
        localStorage.removeItem(draftKey(sessionDate));
      } else {
        localStorage.setItem(draftKey(sessionDate), JSON.stringify({ sessions, stagedBatch }));
      }
    } catch (e) {}
  }, [sessions, stagedBatch, sessionDate, loading]);

  const loadSubmitted = async (date) => {
    const { data } = await supabase
      .from('attendance_logs')
      .select('instructor_id, activity_title, status, in_time, out_time')
      .eq('session_date', date)
      .neq('status', 'Rejected');
    const logs = data || [];
    setSubmittedLogs(logs);
    return logs;
  };

  const onDateChange = async (newDate) => {
    if (!newDate) return;
    setSessionDate(newDate);
    restoreDraft(newDate);
    await loadSubmitted(newDate);
  };

  const scheduledMentors = useMemo(
    () => roster.filter((v) => showAllMentors || (v.designated_days || []).includes(dayOfWeekStr)),
    [roster, showAllMentors, dayOfWeekStr]
  );

  const nameOf = (id) => roster.find((v) => v.student_id === id)?.full_name || id;
  // Informational only — a mentor can have more than one class logged the same day.
  const submittedCountFor = (id) => submittedLogs.filter((l) => l.instructor_id === id && l.activity_title === selectedActivity).length;

  const patchSession = (id, patch) => setSessions((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  // 1. Stamp In-Time
  const handleStampInTime = (studentId) => {
    patchSession(studentId, { in_time: nowHHMM() });
  };

  // 2. Stamp Check Out -> stage the finished session
  const handleStampCheckOut = (studentId) => {
    const s = sessions[studentId] || {};
    if (!s.in_time) return;
    const outTime = nowHHMM();
    if (durationMinutes(s.in_time, outTime) === null) {
      toast('Check-out time is earlier than in-time. Use Undo and re-stamp (or fix it in the manual form).', 'error');
      return;
    }
    // Guards against the same click re-firing before the row re-renders — not
    // against a genuine second class, which can have a different in_time.
    if (stagedBatch.some((b) => b.instructor_id === studentId && b.activity_title === selectedActivity && b.in_time === s.in_time)) {
      toast(`${nameOf(studentId)}'s ${formatClock(s.in_time)} session is already staged.`, 'error');
      return;
    }

    const item = {
      session_date: sessionDate,
      day_of_week: dayOfWeekStr,
      activity_title: selectedActivity,
      instructor_id: studentId,
      instructor_name: nameOf(studentId),
      replacement_id: s.replacement_id || null,
      replacement_name: s.replacement_id ? nameOf(s.replacement_id) : null,
      in_time: s.in_time,
      out_time: outTime,
      topic_covered: 'Regular Teaching Duty',
      fromSheet: true
    };
    setStagedBatch((prev) => [...prev, item]);
    patchSession(studentId, { out_time: outTime, staged: true });
  };

  const handleUndo = (studentId) => {
    setStagedBatch((prev) => prev.filter((b) => !(b.instructor_id === studentId && b.activity_title === selectedActivity && b.fromSheet)));
    setSessions((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  // 3. Replacement teacher (a real roster member, so credit goes to the right person)
  const openReplacement = (studentId) => {
    setReplacementFor(studentId);
    setReplacementPick(sessions[studentId]?.replacement_id || '');
  };

  const saveReplacement = () => {
    const id = replacementFor;
    patchSession(id, { replacement_id: replacementPick || null });
    // If the row was already staged, keep the staged record in sync.
    setStagedBatch((prev) =>
      prev.map((b) =>
        b.instructor_id === id && b.activity_title === selectedActivity && b.fromSheet
          ? { ...b, replacement_id: replacementPick || null, replacement_name: replacementPick ? nameOf(replacementPick) : null }
          : b
      )
    );
    setReplacementFor(null);
  };

  // 4. Manual entry
  const handleAddManualEntry = () => {
    if (!selectedInstructorId) return toast('Choose a volunteer.', 'error');
    if (!selectedActivity) return toast('No active activity is configured. Ask the Admin to add one.', 'error');
    if (!manualInTime || !manualOutTime) return toast('Both in-time and out-time are required.', 'error');
    if (durationMinutes(manualInTime, manualOutTime) === null) return toast('Out-time must be later than in-time.', 'error');
    if (selectedReplacementId && selectedReplacementId === selectedInstructorId) return toast('Replacement cannot be the same person.', 'error');
    // Block only an exact duplicate (same person/activity/date/times) — a mentor can
    // legitimately teach more than one class the same day at different times.
    const isExactDuplicate = (l) =>
      l.instructor_id === selectedInstructorId && l.activity_title === selectedActivity &&
      l.in_time === manualInTime && l.out_time === manualOutTime;
    if (submittedLogs.some(isExactDuplicate) || stagedBatch.some(isExactDuplicate)) {
      return toast(`${nameOf(selectedInstructorId)} already has that exact ${selectedActivity} session for ${sessionDate}.`, 'error');
    }

    const item = {
      session_date: sessionDate,
      day_of_week: dayOfWeekStr,
      activity_title: selectedActivity,
      instructor_id: selectedInstructorId,
      instructor_name: nameOf(selectedInstructorId),
      replacement_id: selectedReplacementId || null,
      replacement_name: selectedReplacementId ? nameOf(selectedReplacementId) : null,
      in_time: manualInTime,
      out_time: manualOutTime,
      topic_covered: manualTopic.trim() || 'General Class'
    };

    setStagedBatch((prev) => [...prev, item]);
    setManualTopic('');
    toast(`Staged: ${item.instructor_name} (${calcHours(item.in_time, item.out_time)})`, 'success');
  };

  // 5. Edit staged entry
  const openEditModal = (index) => {
    const item = stagedBatch[index];
    setEditIndex(index);
    setEditData({
      ...item,
      in_time: formatToTimeInput(item.in_time),
      out_time: formatToTimeInput(item.out_time)
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditModal = () => {
    if (editIndex === null) return;
    if (durationMinutes(editData.in_time, editData.out_time) === null) {
      return toast('Out-time must be later than in-time.', 'error');
    }
    if (editData.replacement_id && editData.replacement_id === editData.instructor_id) {
      return toast('Replacement cannot be the same person.', 'error');
    }
    const updated = {
      ...editData,
      instructor_name: nameOf(editData.instructor_id),
      replacement_id: editData.replacement_id || null,
      replacement_name: editData.replacement_id ? nameOf(editData.replacement_id) : null
    };
    setStagedBatch((prev) => prev.map((b, i) => (i === editIndex ? updated : b)));
    setIsEditModalOpen(false);
  };

  const removeStaged = (idx) => {
    const item = stagedBatch[idx];
    setStagedBatch((prev) => prev.filter((_, i) => i !== idx));
    if (item.fromSheet) {
      setSessions((prev) => {
        const next = { ...prev };
        delete next[item.instructor_id];
        return next;
      });
    }
  };

  // 6. Submit to the approval queue
  const handleSubmitBatch = async () => {
    if (stagedBatch.length === 0) return toast('No staged sessions to submit.', 'error');
    if (!activeVolunteer) return toast('Your coordinator profile could not be found. Sign out and sign in again.', 'error');

    setSubmitting(true);

    // Drop only exact duplicates (same person/activity/times) saved by someone else
    // since this batch was staged — distinct sessions for the same person/day are fine.
    const latest = await loadSubmitted(sessionDate);
    const fresh = stagedBatch.filter((b) => !latest.some((l) =>
      l.instructor_id === b.instructor_id && l.activity_title === b.activity_title &&
      l.in_time === b.in_time && l.out_time === b.out_time
    ));
    const dupes = stagedBatch.length - fresh.length;

    const payloads = fresh.map((item) => ({
      session_date: item.session_date,
      day_of_week: item.day_of_week,
      activity_title: item.activity_title,
      instructor_id: item.instructor_id,
      instructor_name: item.instructor_name,
      replacement_id: item.replacement_id || null,
      replacement_name: item.replacement_name || null,
      // Golden rule: credit belongs to the replacement when there is one.
      credited_to_id: item.replacement_id || item.instructor_id,
      in_time: item.in_time,
      out_time: item.out_time,
      topic_covered: item.topic_covered,
      is_designated_day: (roster.find((v) => v.student_id === item.instructor_id)?.designated_days || []).includes(item.day_of_week),
      validator_id: activeVolunteer.student_id,
      verified_by: `Coordinator Desk: ${activeVolunteer.full_name}`,
      status: 'Pending'
    }));

    if (payloads.length > 0) {
      const { error } = await supabase.from('attendance_logs').insert(payloads);
      if (error) {
        // Keep the batch so nothing is lost; the coordinator can retry.
        setSubmitting(false);
        toast(`Could not submit: ${error.message}. Your batch is still here — try again.`, 'error', 8000);
        return;
      }
    }

    setSubmitting(false);
    setStagedBatch([]);
    setSessions({});
    await loadSubmitted(sessionDate);
    toast(
      `Sent ${payloads.length} session${payloads.length === 1 ? '' : 's'} for approval.` + (dupes ? ` ${dupes} duplicate${dupes === 1 ? '' : 's'} skipped.` : ''),
      'success'
    );
  };

  const filteredRoster = roster.filter(
    (v) =>
      v.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAdmin = (activeVolunteer?.role_level || 0) >= 6;
  // Coordinators can only message people strictly below their own role level;
  // the Master Admin can pick anyone (matches notify_user's own check server-side).
  const messageable = roster.filter((v) => v.student_id !== activeVolunteer?.student_id && (isAdmin || v.role_level < (activeVolunteer?.role_level || 0)));

  const toggleNotifRecipient = (id) => {
    setNotifRecipients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return toast('Title and message are both required.', 'error');
    const recipientIds = notifAudience === 'all'
      ? roster.filter((v) => v.student_id !== activeVolunteer?.student_id).map((v) => v.student_id)
      : notifRecipients;
    if (recipientIds.length === 0) return toast('Pick at least one recipient.', 'error');

    setSendingNotif(true);
    try {
      const sentCount = await sendCustomNotificationToMany(recipientIds, notifTitle.trim(), notifBody.trim());
      toast(
        sentCount === recipientIds.length
          ? `Sent to ${sentCount} recipient${sentCount === 1 ? '' : 's'}.`
          : `Sent to ${sentCount} of ${recipientIds.length} recipients (some were not eligible).`,
        'success'
      );
      setNotifTitle('');
      setNotifBody('');
      setNotifRecipients([]);
    } catch (err) {
      toast(`Could not send: ${err.message}`, 'error', 7000);
    } finally {
      setSendingNotif(false);
    }
  };

  return (
    <AuthGate minRoleLevel={3} requiredRoleName="Coordinator">
      <section>
        <ToastHost />

        {/* HEADER BAR */}
        <div className="page-head">
          <div className="page-head-main">
            <div className="page-head-icon" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>
              <Shield size={21} />
            </div>
            <div>
              <h2 className="page-head-title">Coordinator Attendance Sheet</h2>
              <p className="page-head-subtitle">
                Tap <b>Now</b> when a mentor arrives, <b>Check Out</b> when they finish, then send the batch for approval.
              </p>
            </div>
          </div>
        </div>

        {/* SESSION BAR */}
        <div className="card" style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--surface-sunken)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '14px', alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Activity</label>
              <select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} style={inputStyle}>
                {activities.length === 0 && <option value="">No active activity</option>}
                {activities.map((a) => <option key={a.id} value={a.title}>{a.title}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Session Date</label>
              <input type="date" value={sessionDate} onChange={(e) => onDateChange(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Day</label>
              <div style={{ ...inputStyle, background: '#f1f5f9', fontWeight: 700 }}>{dayOfWeekStr || '--'}</div>
            </div>
          </div>
        </div>

        {/* SCHEDULED MENTORS */}
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800 }}>
                {showAllMentors ? 'All mentors' : `Scheduled for ${dayOfWeekStr}`} ({scheduledMentors.length})
              </h3>
              <label style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showAllMentors} onChange={(e) => setShowAllMentors(e.target.checked)} />
                Show every mentor, not just today&apos;s designated ones
              </label>
            </div>

            <button
              onClick={handleSubmitBatch}
              disabled={submitting || stagedBatch.length === 0}
              className="btn-primary-action"
              style={{ background: stagedBatch.length === 0 ? '#94a3b8' : '#059669' }}
            >
              <Send size={15} /> {submitting ? 'Sending...' : `Send ${stagedBatch.length} for Approval`}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--prodip-muted)' }}>Loading roster...</div>
          ) : scheduledMentors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--prodip-muted)', fontSize: '13.5px' }}>
              No mentor is designated for {dayOfWeekStr}. Tick &ldquo;Show every mentor&rdquo; above to record someone anyway.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="rtable" style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                    <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>MENTOR</th>
                    <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>DAYS</th>
                    <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>IN</th>
                    <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>OUT</th>
                    <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>DURATION</th>
                    <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>REPLACEMENT</th>
                    <th style={{ padding: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledMentors.map((m) => {
                    const s = sessions[m.student_id] || {};
                    const priorCount = submittedCountFor(m.student_id);
                    return (
                      <tr key={m.student_id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                        <td data-label="Mentor" style={{ padding: '14px 12px' }}>
                          <b style={{ fontSize: '14px', color: 'var(--prodip-navy)', display: 'block' }}>{m.full_name}</b>
                          <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)' }}>ID: {m.student_id}</span>
                          {priorCount > 0 && (
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#166534', display: 'block', marginTop: '2px' }}>
                              {priorCount} {selectedActivity} session{priorCount === 1 ? '' : 's'} already logged today
                            </span>
                          )}
                        </td>
                        <td data-label="Days" style={{ padding: '14px 12px', fontSize: '12px' }}>
                          {(m.designated_days || []).map((d) => d.slice(0, 3)).join(', ') || '—'}
                        </td>
                        <td data-label="In" style={{ padding: '14px 12px' }}>
                          {s.in_time ? (
                            <b style={{ color: '#166534' }}>{formatClock(s.in_time)}</b>
                          ) : (
                            <button className="btn-row" onClick={() => handleStampInTime(m.student_id)} style={{ background: '#059669', color: '#fff' }}>
                              ▶ Now
                            </button>
                          )}
                        </td>
                        <td data-label="Out" style={{ padding: '14px 12px' }}>
                          {s.out_time ? (
                            <b style={{ color: '#1e2c4f' }}>{formatClock(s.out_time)}</b>
                          ) : s.in_time ? (
                            <button className="btn-row" onClick={() => handleStampCheckOut(m.student_id)} style={{ background: '#1e2c4f', color: '#fff' }}>
                              Check Out
                            </button>
                          ) : (
                            <span style={{ color: 'var(--prodip-muted)' }}>—</span>
                          )}
                        </td>
                        <td data-label="Duration" style={{ padding: '14px 12px' }}>
                          <b>{s.in_time && s.out_time ? calcHours(s.in_time, s.out_time) : '--'}</b>
                        </td>
                        <td data-label="Replacement" style={{ padding: '14px 12px', fontSize: '12.5px', color: s.replacement_id ? '#6b21a8' : 'var(--prodip-muted)' }}>
                          {s.replacement_id ? `🔀 ${nameOf(s.replacement_id)}` : 'None'}
                        </td>
                        <td data-label="Actions" style={{ padding: '14px 12px', textAlign: 'right' }}>
                          <div className="row-actions">
                            <button className="btn-row" onClick={() => openReplacement(m.student_id)} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', color: '#6b21a8' }}>
                              <ArrowRightLeft size={13} /> Replacement
                            </button>
                            {(s.in_time || s.out_time) && (
                              <button className="btn-row" onClick={() => handleUndo(m.student_id)} style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)', color: '#475569' }}>
                                <Undo2 size={13} /> Undo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MANUAL ENTRY & STAGED BATCH */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '14px', borderBottom: '1px solid var(--prodip-border)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={18} color="var(--prodip-olive)" /> Manual / Late Entry
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Volunteer (Instructor)</label>
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or student ID..."
                  style={{ ...inputStyle, padding: '9px 10px 9px 32px', fontSize: '13px' }}
                />
              </div>
              <select value={selectedInstructorId} onChange={(e) => setSelectedInstructorId(e.target.value)} style={inputStyle}>
                {filteredRoster.map((v) => (
                  <option key={v.student_id} value={v.student_id}>{v.full_name} ({v.student_id})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Substitute / Replacement (if any)</label>
              <select value={selectedReplacementId} onChange={(e) => setSelectedReplacementId(e.target.value)} style={inputStyle}>
                <option value="">None (regular instructor)</option>
                {roster.filter((v) => v.student_id !== selectedInstructorId).map((v) => (
                  <option key={v.student_id} value={v.student_id}>{v.full_name} ({v.student_id})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <label style={labelStyle}>In Time</label>
                <input type="time" value={manualInTime} onChange={(e) => setManualInTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Out Time</label>
                <input type="time" value={manualOutTime} onChange={(e) => setManualOutTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {manualInTime && manualOutTime && (
              <div style={{ fontSize: '12.5px', color: durationMinutes(manualInTime, manualOutTime) === null ? '#b91c1c' : '#64748b', marginBottom: '12px', background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--prodip-border)' }}>
                ⏱️ Duration:{' '}
                <b style={{ color: durationMinutes(manualInTime, manualOutTime) === null ? '#b91c1c' : 'var(--prodip-navy)' }}>
                  {durationMinutes(manualInTime, manualOutTime) === null ? 'Out-time is before in-time' : calcHours(manualInTime, manualOutTime)}
                </b>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Topic / Notes (optional)</label>
              <input type="text" value={manualTopic} onChange={(e) => setManualTopic(e.target.value)} placeholder="e.g. Math Lesson 3" style={inputStyle} />
            </div>

            <button onClick={handleAddManualEntry} className="btn-primary-action" style={{ width: '100%', background: 'var(--prodip-olive)' }}>
              <PlusCircle size={16} /> Stage Entry
            </button>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--prodip-border)', paddingBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--prodip-navy)" /> Staged ({stagedBatch.length})
              </h3>
              {stagedBatch.length > 0 && (
                <button onClick={handleSubmitBatch} disabled={submitting} className="btn-row" style={{ background: 'var(--prodip-navy)', color: '#fff' }}>
                  <Send size={13} /> {submitting ? 'Sending...' : 'Submit'}
                </button>
              )}
            </div>

            {stagedBatch.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stagedBatch.map((item, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', border: '1px solid var(--prodip-border)', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontSize: '14px', color: 'var(--prodip-navy)', display: 'block' }}>{item.instructor_name}</b>
                      <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', display: 'block' }}>
                        {formatClock(item.in_time)} → {formatClock(item.out_time)} · <b>{calcHours(item.in_time, item.out_time)}</b>
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', display: 'block' }}>{item.activity_title}</span>
                      {item.replacement_name && (
                        <span style={{ fontSize: '11.5px', color: '#6b21a8', fontWeight: 600 }}>🔀 Substituted by {item.replacement_name}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn-row" onClick={() => openEditModal(idx)} style={{ background: '#fff', border: '1px solid var(--prodip-border)', color: 'var(--prodip-navy)' }}>
                        <Edit3 size={13} /> Edit
                      </button>
                      <button className="btn-row" aria-label="Remove" onClick={() => removeStaged(idx)} style={{ background: '#fee2e2', border: '1px solid #fecdd3', color: '#991b1b' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--prodip-muted)', padding: '30px 12px', fontSize: '13px' }}>
                Nothing staged yet. Finish a session above (Check Out) or add a manual entry.
              </div>
            )}
          </div>
        </div>

        {/* SEND NOTIFICATION */}
        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
          <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={17} /> Send a Notification
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '14px' }}>
            {isAdmin ? 'Message any volunteer, or broadcast to everyone.' : 'Message volunteers at a lower role level than yours.'}
          </p>

          <div className="segmented" style={{ marginBottom: '14px' }}>
            <button
              type="button"
              className={`segmented-btn ${notifAudience === 'pick' ? 'active' : ''}`}
              onClick={() => setNotifAudience('pick')}
            >
              Pick Recipients
            </button>
            {isAdmin && (
              <button
                type="button"
                className={`segmented-btn ${notifAudience === 'all' ? 'active' : ''}`}
                onClick={() => setNotifAudience('all')}
              >
                Everyone ({roster.length - 1})
              </button>
            )}
          </div>

          {notifAudience === 'pick' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--prodip-border)', borderRadius: '8px', padding: '10px', marginBottom: '14px' }}>
              {messageable.length === 0 ? (
                <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>{isAdmin ? 'No other volunteers to message.' : 'No one at a lower role level to message.'}</span>
              ) : (
                messageable.map((v) => (
                  <label key={v.student_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', background: notifRecipients.includes(v.student_id) ? 'var(--status-info-bg)' : '#f1f5f9', padding: '5px 9px', borderRadius: '14px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={notifRecipients.includes(v.student_id)} onChange={() => toggleNotifRecipient(v.student_id)} />
                    {v.full_name}
                  </label>
                ))
              )}
            </div>
          )}

          <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Title"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              style={inputStyle}
              maxLength={80}
            />
            <textarea
              rows={3}
              placeholder="Message"
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              style={inputStyle}
              maxLength={500}
            />
          </div>

          <button
            className="btn-primary-action"
            disabled={sendingNotif}
            onClick={handleSendNotification}
            style={{ background: sendingNotif ? '#94a3b8' : 'var(--prodip-navy)' }}
          >
            <Send size={15} /> {sendingNotif ? 'Sending...' : 'Send Notification'}
          </button>
        </div>

        {/* REPLACEMENT PICKER */}
        {replacementFor && (
          <div className="modal-overlay active" onClick={() => setReplacementFor(null)}>
            <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', marginBottom: '6px', fontWeight: 800 }}>
                Replacement for {nameOf(replacementFor)}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '14px' }}>
                The substitute gets the class credit; the original mentor is kept on record.
              </p>
              <select value={replacementPick} onChange={(e) => setReplacementPick(e.target.value)} style={{ ...inputStyle, marginBottom: '16px' }}>
                <option value="">None (no replacement)</option>
                {roster.filter((v) => v.student_id !== replacementFor).map((v) => (
                  <option key={v.student_id} value={v.student_id}>{v.full_name} ({v.student_id})</option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn-row" onClick={() => setReplacementFor(null)} style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)' }}>Cancel</button>
                <button className="btn-row" onClick={saveReplacement} style={{ background: 'var(--prodip-olive)', color: '#fff' }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT STAGED ENTRY */}
        {isEditModalOpen && (
          <div className="modal-overlay active">
            <div className="modal" style={{ maxWidth: '500px' }}>
              <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', marginBottom: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} /> Edit Entry (before submitting)
              </h3>

              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Activity</label>
                <select value={editData.activity_title} onChange={(e) => setEditData({ ...editData, activity_title: e.target.value })} style={inputStyle}>
                  {activities.map((a) => <option key={a.id} value={a.title}>{a.title}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Instructor</label>
                  <select value={editData.instructor_id} onChange={(e) => setEditData({ ...editData, instructor_id: e.target.value })} style={inputStyle}>
                    {roster.map((v) => <option key={v.student_id} value={v.student_id}>{v.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Replacement</label>
                  <select value={editData.replacement_id || ''} onChange={(e) => setEditData({ ...editData, replacement_id: e.target.value })} style={inputStyle}>
                    <option value="">None</option>
                    {roster.map((v) => <option key={v.student_id} value={v.student_id}>{v.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <label style={labelStyle}>In Time</label>
                  <input type="time" value={editData.in_time || ''} onChange={(e) => setEditData({ ...editData, in_time: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Out Time</label>
                  <input type="time" value={editData.out_time || ''} onChange={(e) => setEditData({ ...editData, out_time: e.target.value })} style={inputStyle} />
                </div>
              </div>
              {editData.in_time && editData.out_time && (
                <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '12px', background: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--prodip-border)' }}>
                  ⏱️ Duration:{' '}
                  <b style={{ color: durationMinutes(editData.in_time, editData.out_time) === null ? '#b91c1c' : 'var(--prodip-navy)' }}>
                    {durationMinutes(editData.in_time, editData.out_time) === null ? 'Out-time is before in-time' : calcHours(editData.in_time, editData.out_time)}
                  </b>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Topic Covered</label>
                <textarea rows={2} value={editData.topic_covered || ''} onChange={(e) => setEditData({ ...editData, topic_covered: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn-row" style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)' }} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button className="btn-row" style={{ background: 'var(--prodip-olive)', color: '#fff' }} onClick={handleSaveEditModal}>Save Changes</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AuthGate>
  );
}
