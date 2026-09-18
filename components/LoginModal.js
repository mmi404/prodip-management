'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Lock, LogIn, AlertCircle } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    setLoading(false);

    if (error) {
      setErrorMsg('Incorrect email or password. Try again.');
      return;
    }

    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <Lock size={18} color="var(--prodip-navy)" />
          Volunteer Portal Login
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '18px' }}>
          Sign in with your registered email to access 1-Tap Attendance &amp; Dashboard.
        </p>

        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@cuet.ac.bd"
            style={{ padding: '11px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '14px', width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ padding: '11px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '14px', width: '100%' }}
          />
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
              <AlertCircle size={14} />
              {errorMsg}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', padding: '9px 14px', cursor: 'pointer', borderRadius: '8px' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={loading}
            style={{ background: 'var(--prodip-crimson)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '40px' }}
            onClick={handleLogin}
          >
            <LogIn size={15} />
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
}
