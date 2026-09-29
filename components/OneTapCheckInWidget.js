'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import { DAY_NAMES, localDateStr, nowHHMM, durationMinutes, calcHours, formatClock } from '@/lib/time';
import { Zap, Square, CheckCircle2, Calendar, AlertTriangle, Clock, X, Check } from 'lucide-react';

const DEFAULT_ACTIVITY = 'Teaching and Mentorship';

export default function OneTapCheckInWidget({ onOpenLoginModal }) {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [scheduleReason, setScheduleReason] = useState(''); // 'designated' | 'substitute'
  const [substituteReq, setSubstituteReq] = useState(null); // accepted request row, when substituting
  const [activityTitle, setActivityTitle] = useState(DEFAULT_ACTIVITY);
  const [sessionState, setSessionState] = useState('A'); // 'A' = ready to check in, 'B' = ongoing, 'C' = completed
  const [openLogId, setOpenLogId] = useState(null);
  const [logStatus, setLogStatus] = useState('Pending');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [dayLabel, setDayLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Confirmation modal states to prevent accidental taps
  const [confirmModalType, setConfirmModalType] = useState(null); // 'checkin' | 'checkout' | null
  const [currentTimePreview, setCurrentTimePreview] = useState('');

  useEffect(() => {
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkSession());
    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const today = new Date();
    const todayDayName = DAY_NAMES[today.getDay()];
    const todayStr = localDateStr(today);

    // 1. PUBLIC GUEST: hide widget completely
    if (!session) {
      setActiveVolunteer(null);
      setIsScheduledToday(false);
      return;
    }

    // 2. LOGGED IN: resolve roster row
    const vol = await fetchCurrentVolunteer(session);
    setActiveVolunteer(vol);

    // 3. ELIGIBILITY: designated today, or an accepted substitute request for today
    const userDays = Array.isArray(vol.designated_days) ? vol.designated_days : [];
    const isDesignated = userDays.includes(todayDayName);

    const { data: subReq } = await supabase
      .from('substitute_requests')
      .select('*')
      .eq('to_id', vol.student_id)
      .eq('class_date', todayStr)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();
    const isSubstitute = !!subReq;
    setSubstituteReq(subReq || null);

    if (!isDesignated && !isSubstitute) {
      setIsScheduledToday(false);
      return;
    }

    setIsScheduledToday(true);
    setScheduleReason(isSubstitute ? 'substitute' : 'designated');
    setDayLabel(
      isSubstitute
        ? `Today is your accepted substitute class (${todayDayName})`
        : `Today is your designated class session (${todayDayName})`
    );

    // Prefer the standard mentoring activity if it exists, else the first active one.
    const { data: acts } = await supabase.from('activities').select('title').eq('status', 'Active').order('title');
    if (acts && acts.length > 0) {
      setActivityTitle(acts.find((a) => a.title === DEFAULT_ACTIVITY)?.title || acts[0].title);
    }

    // 4. TODAY'S LOG — the database is the only source of truth (no localStorage copy).
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('credited_to_id', vol.student_id)
      .eq('session_date', todayStr)
      .neq('status', 'Rejected')
      .order('id', { ascending: false })
      .limit(1);

    const existing = logs && logs.length > 0 ? logs[0] : null;
    if (!existing) {
      setSessionState('A');
      setOpenLogId(null);
    } else if (!existing.out_time) {
      setSessionState('B');
      setOpenLogId(existing.id);
      setInTime(existing.in_time);
    } else {
      setSessionState('C');
      setInTime(existing.in_time);
      setOutTime(existing.out_time);
      setLogStatus(existing.status);
    }
  };

  const openConfirmation = (type) => {
    setErrorMsg('');
    setCurrentTimePreview(formatClock(nowHHMM()));
    setConfirmModalType(type);
  };

  const closeConfirmation = () => setConfirmModalType(null);

  const handleConfirmCheckIn = async () => {
    closeConfirmation();
    if (!activeVolunteer || busy) return;
    setBusy(true);
    setErrorMsg('');

    const today = new Date();
    const isSub = scheduleReason === 'substitute' && substituteReq;

    // Replacement Teacher rule: the original mentor stays on record as instructor,
    // the person who actually taught is the replacement and gets the credit.
    const payload = {
      session_date: localDateStr(today),
      day_of_week: DAY_NAMES[today.getDay()],
      activity_title: activityTitle,
      instructor_id: isSub ? substituteReq.from_id : activeVolunteer.student_id,
      instructor_name: isSub ? substituteReq.from_name : activeVolunteer.full_name,
      replacement_id: isSub ? activeVolunteer.student_id : null,
      replacement_name: isSub ? activeVolunteer.full_name : null,
      credited_to_id: activeVolunteer.student_id,
      in_time: nowHHMM(today),
      out_time: null,
      topic_covered: isSub ? 'Substitute Class Attendance' : 'Designated Class Attendance',
      is_designated_day: scheduleReason === 'designated',
      validator_id: activeVolunteer.student_id,
      verified_by: `1-Tap Check-In: ${activeVolunteer.full_name} (${activeVolunteer.student_id})`,
      status: 'Pending'
    };

    const { data, error } = await supabase.from('attendance_logs').insert([payload]).select('id').single();
    setBusy(false);

    if (error) {
      setErrorMsg(`Check-in was NOT saved: ${error.message}`);
      return;
    }

    setOpenLogId(data.id);
    setInTime(payload.in_time);
    setSessionState('B');
  };

  const handleConfirmCheckOut = async () => {
    closeConfirmation();
    if (!activeVolunteer || busy || !openLogId) return;
    setBusy(true);
    setErrorMsg('');

    const currentTime = nowHHMM();
    if (durationMinutes(inTime, currentTime) === null) {
      setBusy(false);
      setErrorMsg('Your device clock is earlier than your check-in time. Ask a coordinator to fix this session.');
      return;
    }

    const { error } = await supabase.from('attendance_logs').update({ out_time: currentTime }).eq('id', openLogId);
    setBusy(false);

    if (error) {
      setErrorMsg(`Check-out was NOT saved: ${error.message}`);
      return;
    }

    setOutTime(currentTime);
    setLogStatus('Pending');
    setSessionState('C');
  };

  // 1. IF NOT LOGGED IN: Render nothing (strictly for designated teachers)
  if (!activeVolunteer) {
    return null;
  }

  // 2. IF LOGGED IN BUT NOT SCHEDULED TODAY: Render subtle informative schedule note
  if (!isScheduledToday) {
    const userDays = Array.isArray(activeVolunteer.designated_days) ? activeVolunteer.designated_days.join(', ') : 'None assigned';
    return (
      <div style={{
        background: '#f8fafc',
        border: '1px solid var(--prodip-border)',
        padding: '12px 18px',
        borderRadius: '12px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
          <Calendar size={16} color="var(--prodip-olive)" />
          <span><b>Schedule Status:</b> No class session scheduled for you today.</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>
          Your designated class days: <b style={{ color: 'var(--prodip-navy)' }}>{userDays}</b>
        </div>
      </div>
    );
  }

  // 3. IF TODAY IS FINISHED (In & Out both recorded): Hide button, show clean completed badge
  if (sessionState === 'C') {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        border: '1px solid #86efac',
        padding: '16px 20px',
        borderRadius: '14px',
        marginBottom: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(22,101,52,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: '#22c55e',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <b style={{ fontSize: '15px', color: '#166534', display: 'block' }}>
              Today's Class Session Completed!
            </b>
            <span style={{ fontSize: '12.5px', color: '#15803d' }}>
              In <b>{formatClock(inTime)}</b> · Out <b>{formatClock(outTime)}</b> · <b>{calcHours(inTime, outTime)}</b> logged
            </span>
          </div>
        </div>
        <span style={{
          background: '#bbf7d0',
          color: '#166534',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '11.5px',
          fontWeight: 800
        }}>
          {logStatus === 'Approved' ? 'Approved ✓' : 'Sent for Approval'}
        </span>
      </div>
    );
  }

  // 4. ACTIVE ELIGIBLE STATES (State A: Ready to Start, State B: Session Ongoing)
  return (
    <>
      <div className="landing-one-tap-card">
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--prodip-gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          {dayLabel}
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', fontWeight: 600, margin: '8px auto 4px', maxWidth: '460px', textAlign: 'left' }}>
            {errorMsg}
          </div>
        )}

        {sessionState === 'A' && (
          <div>
            <button className="circular-tap-btn checkin" disabled={busy} onClick={() => openConfirmation('checkin')}>
              <Zap size={32} />
              <span>CHECK IN</span>
            </button>
            <div className="tap-subtitle">
              Tap to stamp class start time &amp; record attendance
            </div>
          </div>
        )}

        {sessionState === 'B' && (
          <div>
            <button className="circular-tap-btn checkout" disabled={busy} onClick={() => openConfirmation('checkout')}>
              <Square size={32} />
              <span>CHECK OUT</span>
            </button>
            <div className="tap-subtitle">
              🟢 Session ongoing (started <b>{formatClock(inTime)}</b>) · Tap to finish today&apos;s session
            </div>
          </div>
        )}
      </div>

      {/* POPUP CONFIRMATION MODAL TO PREVENT UNWANTED ACCIDENTAL TAPS */}
      {confirmModalType && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '28px 24px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: confirmModalType === 'checkin' ? '#dcfce7' : '#fee2e2',
              color: confirmModalType === 'checkin' ? '#166534' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto'
            }}>
              {confirmModalType === 'checkin' ? <Clock size={28} /> : <AlertTriangle size={28} />}
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--prodip-navy)', marginBottom: '8px' }}>
              {confirmModalType === 'checkin' ? 'Confirm Class Session Start' : 'Confirm Class Session End'}
            </h3>

            <p style={{ fontSize: '13.5px', color: 'var(--prodip-muted)', lineHeight: 1.5, marginBottom: '22px' }}>
              {confirmModalType === 'checkin' ? (
                <>
                  Are you ready to start today's class session now at <b>{currentTimePreview}</b>?
                  This will register your active attendance.
                </>
              ) : (
                <>
                  Are you ready to end today's class session at <b>{currentTimePreview}</b>?
                  This will finalize your attendance record for today (only one session allowed per day).
                </>
              )}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={closeConfirmation}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModalType === 'checkin' ? handleConfirmCheckIn : handleConfirmCheckOut}
                style={{
                  background: confirmModalType === 'checkin' ? '#059669' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={16} />
                {confirmModalType === 'checkin' ? 'Yes, Start Class' : 'Yes, Check Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
