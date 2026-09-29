'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import { subscribeToPush, pushSupported } from '@/lib/push';

export default function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = async () => {
    if (!pushSupported() || Notification.permission !== 'default' || sessionStorage.getItem('push_prompt_dismissed')) {
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const vol = await fetchCurrentVolunteer(session);
    if (vol?.student_id) {
      setStudentId(vol.student_id);
      setShowPrompt(true);
    }
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setShowPrompt(false);
        return;
      }
      await subscribeToPush(studentId);
    } catch (err) {
      console.error('Push subscription failed:', err);
    } finally {
      setEnabling(false);
      setShowPrompt(false);
    }
  };

  const handleLater = () => {
    setShowPrompt(false);
    sessionStorage.setItem('push_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e2c4f, #141e36)',
      color: 'white',
      padding: '14px 18px',
      borderRadius: '14px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      border: '1px solid var(--prodip-gold)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'rgba(229,168,35,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--prodip-gold)',
          flexShrink: 0
        }}>
          <Bell size={20} />
        </div>
        <div>
          <b style={{ fontSize: '14px', color: '#fff', display: 'block' }}>Enable Instant Push Notifications</b>
          <span style={{ fontSize: '12.5px', color: '#cbd5e1' }}>Get alerts for class reminders, substitute requests, and milestones — even when this tab is closed.</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          style={{ background: 'var(--prodip-gold)', color: '#000', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: enabling ? 'default' : 'pointer', opacity: enabling ? 0.7 : 1 }}
          onClick={handleEnable}
          disabled={enabling}
        >
          {enabling ? 'Enabling...' : 'Enable Notifications'}
        </button>
        <button
          style={{ background: 'transparent', color: '#94a3b8', border: 'none', padding: '9px 12px', fontSize: '13px', cursor: 'pointer' }}
          onClick={handleLater}
        >
          Later
        </button>
      </div>
    </div>
  );
}
