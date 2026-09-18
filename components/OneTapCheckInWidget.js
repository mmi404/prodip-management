'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Zap, Square, CheckCircle2 } from 'lucide-react';

export default function OneTapCheckInWidget({ onOpenLoginModal }) {
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [sessionState, setSessionState] = useState('A'); // 'A' = ready, 'B' = ongoing, 'C' = completed
  const [inTime, setInTime] = useState('--:--');
  const [outTime, setOutTime] = useState('--:--');
  const [dayLabel, setDayLabel] = useState('Quick Volunteer Attendance Check-In');

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

    if (!session) {
      setActiveVolunteer(null);
      setDayLabel(`Today is ${todayDayName} · Quick Class Check-In`);
      setSessionState('A');
      return;
    }

    const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
    if (vol) {
      setActiveVolunteer(vol);
      const userDays = vol.designated_days || [];
      const isDesignatedToday = userDays.includes(todayDayName);
      setDayLabel(isDesignatedToday ? `Today is your Designated Class Session (${todayDayName})` : `${todayDayName} Class Session`);

      // Check existing log for today
      const { data: logs } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('credited_to_id', vol.student_id)
        .eq('session_date', todayStr)
        .order('id', { ascending: false });

      const localLog = JSON.parse(localStorage.getItem(`self_session_${vol.student_id}_${todayStr}`) || 'null');
      const existingLog = (logs && logs.length > 0) ? logs[0] : localLog;

      if (!existingLog) {
        setSessionState('A');
      } else if (!existingLog.out_time) {
        setSessionState('B');
        setInTime(existingLog.in_time);
      } else {
        setSessionState('C');
        setInTime(existingLog.in_time);
        setOutTime(existingLog.out_time);
      }
    }
  };

  const handleCheckIn = async () => {
    if (!activeVolunteer) {
      if (onOpenLoginModal) onOpenLoginModal();
      return;
    }

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
      topic_covered: null,
      is_designated_day: true,
      validator_id: activeVolunteer.student_id,
      verified_by: `1-Tap Check-In: ${activeVolunteer.full_name} (${activeVolunteer.student_id})`,
      status: 'Pending'
    };

    localStorage.setItem(`self_session_${activeVolunteer.student_id}_${todayStr}`, JSON.stringify(payload));
    await supabase.from('attendance_logs').insert([payload]);

    setInTime(currentTime);
    setSessionState('B');
  };

  const handleCheckOut = async () => {
    if (!activeVolunteer) return;
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const hh = String(today.getHours()).padStart(2, '0');
    const mm = String(today.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    const localLog = JSON.parse(localStorage.getItem(`self_session_${activeVolunteer.student_id}_${todayStr}`) || '{}');
    localLog.out_time = currentTime;
    localStorage.setItem(`self_session_${activeVolunteer.student_id}_${todayStr}`, JSON.stringify(localLog));

    const { data } = await supabase
      .from('attendance_logs')
      .select('id')
      .eq('credited_to_id', activeVolunteer.student_id)
      .eq('session_date', todayStr)
      .is('out_time', null);

    if (data && data.length > 0) {
      await supabase.from('attendance_logs').update({ out_time: currentTime }).eq('id', data[0].id);
    } else {
      await supabase.from('attendance_logs').insert([localLog]);
    }

    setOutTime(currentTime);
    setSessionState('C');
  };

  return (
    <div className="landing-one-tap-card">
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--prodip-gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {dayLabel}
      </div>

      {sessionState === 'A' && (
        <div>
          <button className="circular-tap-btn checkin" onClick={handleCheckIn}>
            <Zap size={32} />
            <span>CHECK IN</span>
          </button>
          <div className="tap-subtitle">
            {activeVolunteer ? '1-Tap Circular Button to Start Class Attendance' : 'Sign in to 1-Tap Check In for Today\'s Class'}
          </div>
        </div>
      )}

      {sessionState === 'B' && (
        <div>
          <button className="circular-tap-btn checkout" onClick={handleCheckOut}>
            <Square size={32} />
            <span>CHECK OUT</span>
          </button>
          <div className="tap-subtitle">
            🟢 Session Ongoing (Checked in at <b>{inTime}</b>) · 1-Tap to Finish &amp; Check Out
          </div>
        </div>
      )}

      {sessionState === 'C' && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#4ade80', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <CheckCircle2 size={18} /> Today's Class Session Logged!
          </div>
          <div className="tap-subtitle">
            In: {inTime} | Out: {outTime} · Sent for Master Approval
          </div>
        </div>
      )}
    </div>
  );
}
