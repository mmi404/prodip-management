'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Lock, LogIn, UserPlus, AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'signup'

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign Up State
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpStudentId, setSignUpStudentId] = useState('');
  const [signUpDepartment, setSignUpDepartment] = useState('CSE');
  const [signUpBatch, setSignUpBatch] = useState("'22");
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  // Status
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (!signInEmail.trim() || !signInPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
      password: signInPassword
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message || 'Incorrect email or password. Try again.');
      return;
    }

    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  const handleSignUp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!signUpFullName.trim() || !signUpStudentId.trim() || !signUpEmail.trim()) {
      setErrorMsg('Full Name, Student ID, and Email are required.');
      return;
    }

    if (signUpPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: signUpEmail.trim(),
      password: signUpPassword,
      options: {
        data: {
          full_name: signUpFullName.trim(),
          student_id: signUpStudentId.trim(),
          department: signUpDepartment,
          batch: signUpBatch
        }
      }
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('not on the Prodip volunteer roster')) {
        const pending = JSON.parse(localStorage.getItem('prodip_pending_registrations') || '[]');
        pending.push({
          student_id: signUpStudentId.trim(),
          full_name: signUpFullName.trim(),
          email: signUpEmail.trim(),
          department: signUpDepartment,
          batch: signUpBatch,
          submitted_at: new Date().toISOString()
        });
        localStorage.setItem('prodip_pending_registrations', JSON.stringify(pending));

        setErrorMsg('Your registration request has been submitted to the Master Admin for roster approval. You will be able to log in once approved.');
        return;
      }

      setErrorMsg(error.message || 'Failed to create account.');
      return;
    }

    if (data?.session) {
      setSuccessMsg('Account created! Logging in...');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1000);
    } else {
      setSuccessMsg('Registration successful! Please check your email to confirm, then sign in.');
      setActiveTab('signin');
      setSignInEmail(signUpEmail.trim());
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: '460px', width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          {activeTab === 'signin' ? <Lock size={18} color="var(--prodip-navy)" /> : <UserPlus size={18} color="var(--prodip-navy)" />}
          {activeTab === 'signin' ? 'Volunteer Portal Login' : 'Volunteer Registration'}
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '16px' }}>
          {activeTab === 'signin' 
            ? 'Sign in to access 1-Tap attendance and dashboard.' 
            : 'Register your CUET credentials to join Prodip as a volunteer.'}
        </p>

        {/* TAB TOGGLE */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'signin' ? '#fff' : 'transparent',
              color: activeTab === 'signin' ? 'var(--prodip-navy)' : 'var(--prodip-muted)',
              boxShadow: activeTab === 'signin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'signup' ? '#fff' : 'transparent',
              color: activeTab === 'signup' ? 'var(--prodip-navy)' : 'var(--prodip-muted)',
              boxShadow: activeTab === 'signup' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Sign Up / Register
          </button>
        </div>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11.5px', color: '#dc2626', background: '#fee2e2', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11.5px', color: '#166534', background: '#dcfce7', padding: '10px 12px', borderRadius: '6px', marginBottom: '14px' }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {activeTab === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Email Address</label>
              <input
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="e.g. golamrabbanynb@gmail.com"
                required
                style={{ padding: '9px 12px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Password</label>
              <input
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ padding: '9px 12px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ background: 'var(--prodip-crimson)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <LogIn size={14} />
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  value={signUpFullName}
                  onChange={(e) => setSignUpFullName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Student ID *</label>
                <input
                  type="text"
                  value={signUpStudentId}
                  onChange={(e) => setSignUpStudentId(e.target.value)}
                  placeholder="e.g. 2101104"
                  required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Dept</label>
                <select
                  value={signUpDepartment}
                  onChange={(e) => setSignUpDepartment(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px', background: 'white' }}
                >
                  <option value="CSE">CSE</option>
                  <option value="EEE">EEE</option>
                  <option value="ME">ME</option>
                  <option value="Civil">Civil</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Batch</label>
                <input
                  type="text"
                  value={signUpBatch}
                  onChange={(e) => setSignUpBatch(e.target.value)}
                  placeholder="'21"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Email Address *</label>
              <input
                type="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                placeholder="you@cuet.ac.bd"
                required
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Password *</label>
                <input
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Confirm *</label>
                <input
                  type="password"
                  value={signUpConfirmPassword}
                  onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                  placeholder="Re-type"
                  required
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px' }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ background: 'var(--prodip-navy)', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <UserPlus size={14} />
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
