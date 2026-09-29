'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { localDateStr, dayNameOf } from '@/lib/time';
import { ArrowRightLeft, Send } from 'lucide-react';

export default function SubstituteRequestBox({ activeVolunteer, onSent }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolId, setSelectedVolId] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(null); // { type: 'ok' | 'err', text }
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (activeVolunteer) {
      setSelectedDate(localDateStr());
      fetchVolunteers();
    }
  }, [activeVolunteer]);

  // Mentors can't read the full volunteers table (RLS), so use the name-only directory view.
  const fetchVolunteers = async () => {
    let { data, error } = await supabase
      .from('volunteer_directory')
      .select('student_id, full_name, department')
      .neq('student_id', activeVolunteer.student_id)
      .order('full_name');

    if (error) {
      ({ data } = await supabase
        .from('volunteers')
        .select('student_id, full_name, department')
        .neq('student_id', activeVolunteer.student_id)
        .order('full_name'));
    }

    setVolunteers(data || []);
    if (data && data.length > 0) setSelectedVolId(data[0].student_id);
  };

  const handleSendRequest = async () => {
    setStatus(null);
    if (!selectedDate) return setStatus({ type: 'err', text: 'Please select the class date.' });
    if (selectedDate < localDateStr()) return setStatus({ type: 'err', text: 'The class date cannot be in the past.' });
    if (!selectedVolId) return setStatus({ type: 'err', text: 'Please choose a substitute volunteer.' });

    const subVol = volunteers.find((v) => v.student_id === selectedVolId);

    setSending(true);
    const { error } = await supabase.from('substitute_requests').insert([
      {
        from_id: activeVolunteer.student_id,
        from_name: activeVolunteer.full_name,
        to_id: selectedVolId,
        to_name: subVol ? subVol.full_name : selectedVolId,
        class_day: dayNameOf(selectedDate),
        class_date: selectedDate,
        note: note.trim() || null
      }
    ]);
    setSending(false);

    if (error) {
      setStatus({ type: 'err', text: `Request not sent: ${error.message}` });
      return;
    }

    setStatus({ type: 'ok', text: `Request sent to ${subVol ? subVol.full_name : selectedVolId}.` });
    setNote('');
    if (onSent) onSent();
  };

  return (
    <div className="card substitute-request-card" style={{ background: 'linear-gradient(135deg, #ffffff, #fdfbf7)', border: '2px solid var(--prodip-gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--prodip-border)', paddingBottom: '10px' }}>
        <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto' }}>
          <ArrowRightLeft size={18} color="var(--prodip-gold)" />
          Request a Substitute Teacher
        </h3>
        <span className="badge badge-warning">Class Duty Transfer</span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--prodip-muted)', marginBottom: '16px' }}>
        Need someone to cover your class? Pick the date, choose a volunteer, and send a request. They accept it from their own device.
      </p>

      {status && (
        <div style={{ background: status.type === 'ok' ? '#dcfce7' : '#fee2e2', color: status.type === 'ok' ? '#166534' : '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>
          {status.text}
        </div>
      )}

      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
          Class Date {selectedDate ? `(${dayNameOf(selectedDate)})` : ''}
        </label>
        <input
          type="date"
          value={selectedDate}
          min={localDateStr()}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
        />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Choose Available Volunteer</label>
        <select
          value={selectedVolId}
          onChange={(e) => setSelectedVolId(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
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
        disabled={sending}
      >
        <Send size={15} />
        {sending ? 'Sending...' : 'Send Substitute Request'}
      </button>
    </div>
  );
}
