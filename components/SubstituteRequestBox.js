'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ArrowRightLeft, Send } from 'lucide-react';

export default function SubstituteRequestBox({ activeVolunteer }) {
  const [designatedDays, setDesignatedDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolId, setSelectedVolId] = useState('');
  const [note, setNote] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (activeVolunteer) {
      const days = activeVolunteer.designated_days || [];
      const allWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const availableDays = days.length > 0 ? days : allWeek;
      setDesignatedDays(availableDays);
      setSelectedDay(availableDays[0] || '');

      const today = new Date();
      const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${d}`);

      fetchVolunteers();
    }
  }, [activeVolunteer]);

  const fetchVolunteers = async () => {
    const { data } = await supabase
      .from('volunteers')
      .select('*')
      .neq('student_id', activeVolunteer.student_id)
      .order('full_name');

    if (data) {
      setVolunteers(data);
      if (data.length > 0) setSelectedVolId(data[0].student_id);
    }
  };

  const handleSendRequest = () => {
    if (!selectedDate) {
      alert('Please select the class session date.');
      return;
    }
    if (!selectedVolId) {
      alert('Please select a substitute volunteer from the list.');
      return;
    }

    const subVol = volunteers.find(v => v.student_id === selectedVolId);
    const subName = subVol ? subVol.full_name : selectedVolId;

    const reqPayload = {
      id: 'subreq_' + Date.now(),
      from_id: activeVolunteer.student_id,
      from_name: activeVolunteer.full_name,
      to_id: selectedVolId,
      to_name: subName,
      class_day: selectedDay,
      class_date: selectedDate,
      note: note.trim(),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const existingRequests = JSON.parse(localStorage.getItem('prodip_substitute_requests') || '[]');
    existingRequests.push(reqPayload);
    localStorage.setItem('prodip_substitute_requests', JSON.stringify(existingRequests));

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Substitute Request Sent', {
          body: `Your request for ${selectedDate} was sent to ${subName}.`,
          icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        });
      } catch (e) {}
    }

    setStatusMsg(`✅ Substitute request sent to ${subName}!`);
    setNote('');
    setTimeout(() => setStatusMsg(null), 3500);
  };

  return (
    <div className="card substitute-request-card" style={{ background: 'linear-gradient(135deg, #ffffff, #fdfbf7)', border: '2px solid var(--prodip-gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--prodip-border)', paddingBottom: '10px' }}>
        <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto' }}>
          <ArrowRightLeft size={18} color="var(--prodip-gold)" />
          Request a Substitute Teacher
        </h3>
        <span className="role-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '11px', padding: '4px 10px' }}>
          Class Duty Transfer
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--prodip-muted)', marginBottom: '16px' }}>
        Need someone to cover your class? Select your designated day, choose an available volunteer, and send a request.
      </p>

      {statusMsg && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Select Designated Day</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
          >
            {designatedDays.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Class Session Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Choose Available Volunteer</label>
        <select
          value={selectedVolId}
          onChange={(e) => setSelectedVolId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
        >
          {volunteers.map((v) => (
            <option key={v.student_id} value={v.student_id}>
              {v.full_name} ({v.student_id}) - {v.department || ''}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Reason / Note (Optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Midterm exam conflict, family emergency..."
          style={{ width: '100%', padding: '9.5px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px', background: '#fff' }}
        />
      </div>

      <button
        style={{
          width: '100%',
          background: 'var(--prodip-navy)',
          color: 'white',
          border: 'none',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: '46px'
        }}
        onClick={handleSendRequest}
      >
        <Send size={15} />
        Send Substitute Request
      </button>
    </div>
  );
}
