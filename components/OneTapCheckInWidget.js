'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Zap, Square, CheckCircle2, Calendar, AlertTriangle, Clock, X, Check } from 'lucide-react';

export default function OneTapCheckInWidget({ onOpenLoginModal }) {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [isScheduledToday, setIsScheduledToday] = useState(false);
  const [scheduleReason, setScheduleReason] = useState(''); // 'designated' | 'substitute'
  const [sessionState, setSessionState] = useState('A'); // 'A' = ready to check in, 'B' = ongoing, 'C' = completed
  const [inTime, setInTime] = useState('--:--');
  const [outTime, setOutTime] = useState('--:--');
  const [totalHours, setTotalHours] = useState('2.0');
  const [dayLabel, setDayLabel] = useState('');

  // Confirmation modal states to prevent accidental taps
  const [confirmModalType, setConfirmModalType] = useState(null); // 'checkin' | 'checkout' | null
  const [currentTimePreview, setCurrentTimePreview] = useState('');

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const today = new Date();
    const todayDayName = dayNames[today.getDay()];
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    // 1. PUBLIC GUEST: If not logged in, completely hide widget
    if (!session) {
      setActiveVolunteer(null);
      setIsScheduledToday(false);
      return;
    }

    // 2. LOGGED IN: Fetch volunteer record
    let vol = null;
    const { data: volData } = await supabase
      .from('volunteers')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single();

    if (volData) {
      vol = volData;
    } else {
      const { data: volByEmail } = await supabase
        .from('volunteers')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (volByEmail) {
        vol = volByEmail;
      } else {
        const studentId = session.user.user_metadata?.student_id || session.user.email?.split('@')[0] || 'VOLUNTEER';
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Volunteer';
        vol = {
          student_id: studentId,
          full_name: fullName,
          email: session.user.email,
          designated_days: [],
          target_classes: 20
        };
      }
    }

    setActiveVolunteer(vol);

    // 3. CHECK SCHEDULE ELIGIBILITY:
    // A. Is today in designated_days?
    const userDays = Array.isArray(vol.designated_days) ? vol.designated_days : [];
    const isDesignated = userDays.includes(todayDayName);

    // B. Is volunteer an accepted substitute for today?
    const substituteRequests = JSON.parse(localStorage.getItem('prodip_substitute_requests') || '[]');
    const isSubstitute = substituteRequests.some(r =>
      r.to_id === vol.student_id &&
      (r.class_date === todayStr || r.class_date === todayDayName) &&
      r.status === 'accepted'
    );

    if (!isDesignated && !isSubstitute) {
      setIsScheduledToday(false);
      setDayLabel(`No class scheduled for you today (${todayDayName})`);
      return;
    }

    // Eligible!
    setIsScheduledToday(true);
    setScheduleReason(isSubstitute ? 'substitute' : 'designated');
    setDayLabel(isSubstitute
      ? `Today is your Accepted Substitute Class (${todayDayName})`
      : `Today is your Designated Class Session (${todayDayName})`
    );

    // 4. CHECK EXISTING LOG FOR TODAY:
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('credited_to_id', vol.student_id)
      .eq('session_date', todayStr)
      .order('id', { ascending: false });

    const localLog = JSON.parse(localStorage.getItem(`self_session_${vol.student_id}_${todayStr}`) || 'null');
    const existingLog = (logs && logs.length > 0) ? logs[0] : localLog;

    if (!existingLog) {
      setSessionState('A'); // Ready to check in
    } else if (!existingLog.out_time) {
      setSessionState('B'); // Session currently ongoing
      setInTime(existingLog.in_time);
    } else {
      // Both in_time and out_time exist -> Completed for today!
      setSessionState('C');
      setInTime(existingLog.in_time);
      setOutTime(existingLog.out_time);
      setTotalHours(existingLog.hours || '2.0');
    }
  };

  const openConfirmation = (type) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setCurrentTimePreview(`${hh}:${mm}`);
    setConfirmModalType(type);
  };

  const closeConfirmation = () => {
    setConfirmModalType(null);
  };

  const handleConfirmCheckIn = async () => {
    closeConfirmation();
    if (!activeVolunteer) return;

    const today = new Date();
    const todayDayName = dayNames[today.getDay()];
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const hh = String(today.getHours()).padStart(2, '0');
    const mm = String(today.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    const payload = {
      session_date: todayStr,
      day_of_week: todayDayName,
      activity_title: 'Teaching and Mentorship',
      instructor_id: activeVolunteer.student_id,
      instructor_name: activeVolunteer.full_name,
      replacement_id: null,
      replacement_name: null,
      credited_to_id: activeVolunteer.student_id,
      in_time: currentTime,
      out_time: null,
      topic_covered: scheduleReason === 'substitute' ? 'Substitute Class Attendance' : 'Designated Class Attendance',
      is_designated_day: scheduleReason === 'designated',
      validator_id: activeVolunteer.student_id,
      verified_by: `1-Tap Check-In: ${activeVolunteer.full_name} (${activeVolunteer.student_id})`,
      status: 'Pending'
    };

    localStorage.setItem(`self_session_${activeVolunteer.student_id}_${todayStr}`, JSON.stringify(payload));
    await supabase.from('attendance_logs').insert([payload]);

    setInTime(currentTime);
    setSessionState('B');
  };

  const handleConfirmCheckOut = async () => {
    closeConfirmation();
    if (!activeVolunteer) return;

    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const hh = String(today.getHours()).padStart(2, '0');
    const mm = String(today.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    // Calculate hours
    let calculatedHours = '2.0';
    if (inTime && inTime.includes(':')) {
      const [inH, inM] = inTime.split(':').map(Number);
      const diffMins = (today.getHours() * 60 + today.getMinutes()) - (inH * 60 + inM);
      if (diffMins > 0) {
        calculatedHours = (diffMins / 60).toFixed(1);
      }
    }

    const localLog = JSON.parse(localStorage.getItem(`self_session_${activeVolunteer.student_id}_${todayStr}`) || '{}');
    localLog.out_time = currentTime;
    localLog.hours = calculatedHours;
    localStorage.setItem(`self_session_${activeVolunteer.student_id}_${todayStr}`, JSON.stringify(localLog));

    const { data } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('credited_to_id', activeVolunteer.student_id)
      .eq('session_date', todayStr)
      .is('out_time', null);

    if (data && data.length > 0) {
      await supabase.from('attendance_logs').update({ out_time: currentTime, hours: calculatedHours }).eq('id', data[0].id);
    } else {
      await supabase.from('attendance_logs').insert([localLog]);
    }

    setOutTime(currentTime);
    setTotalHours(calculatedHours);
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
              Checked In: <b>{inTime}</b> · Checked Out: <b>{outTime}</b> ({totalHours} Hours logged)
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
          Sent for Master Approval
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

        {sessionState === 'A' && (
          <div>
            <button className="circular-tap-btn checkin" onClick={() => openConfirmation('checkin')}>
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
            <button className="circular-tap-btn checkout" onClick={() => openConfirmation('checkout')}>
              <Square size={32} />
              <span>CHECK OUT</span>
            </button>
            <div className="tap-subtitle">
              🟢 Session Ongoing (Started at <b>{inTime}</b>) · Tap to finish today's session
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
