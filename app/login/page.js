'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Lock, LogIn, UserPlus, AlertCircle, CheckCircle2, ArrowLeft, Shield, User, Info } from 'lucide-react';

function AuthPortal() {
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
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  
  // Feedback States
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/profile';

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push(redirectTo);
    }
  };

  // 1. SIGN IN SUBMIT
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

    router.push(redirectTo);
  };

  // 2. SIGN UP / REGISTER SUBMIT
  const handleSignUp = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!signUpFullName.trim() || !signUpStudentId.trim() || !signUpEmail.trim()) {
      setErrorMsg('Full Name, Student ID, and Email Address are required.');
      return;
    }

    if (signUpPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMsg('Passwords do not match. Please re-type password.');
      return;
    }

    setLoading(true);

    // Call Supabase auth signUp with volunteer metadata
    const { data, error } = await supabase.auth.signUp({
      email: signUpEmail.trim(),
      password: signUpPassword,
      options: {
        data: {
          full_name: signUpFullName.trim(),
          student_id: signUpStudentId.trim(),
          department: signUpDepartment,
          batch: signUpBatch,
          phone: signUpPhone.trim()
        }
      }
    });

    setLoading(false);

    if (error) {
      // If database trigger rejected because email wasn't on roster yet
      if (error.message.includes('not on the Prodip volunteer roster')) {
        // Save pending registration request locally for Master Admin
        const pending = JSON.parse(localStorage.getItem('prodip_pending_registrations') || '[]');
        pending.push({
          student_id: signUpStudentId.trim(),
          full_name: signUpFullName.trim(),
          email: signUpEmail.trim(),
          department: signUpDepartment,
          batch: signUpBatch,
          phone: signUpPhone.trim(),
          submitted_at: new Date().toISOString()
        });
        localStorage.setItem('prodip_pending_registrations', JSON.stringify(pending));

        setErrorMsg(
          'Your email is not on the official roster yet. Your registration request has been submitted to the Master Admin for roster approval. You will be able to sign in as soon as Admin approves your entry.'
        );
        return;
      }

      setErrorMsg(error.message || 'Failed to create volunteer account. Please try again.');
      return;
    }

    // Success! If session returned immediately (email confirmation off):
    if (data?.session) {
      setSuccessMsg('✅ Account created and linked successfully! Redirecting to dashboard...');
      setTimeout(() => router.push(redirectTo), 1200);
    } else {
      setSuccessMsg('✅ Registration successful! Please check your email inbox to confirm your account, then sign in.');
      setActiveTab('signin');
      setSignInEmail(signUpEmail.trim());
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto 80px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px 28px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        
        {/* BRAND HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'rgba(229,168,35,0.15)',
            color: 'var(--prodip-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto'
          }}>
            {activeTab === 'signin' ? <Lock size={24} color="var(--prodip-navy)" /> : <UserPlus size={24} color="var(--prodip-navy)" />}
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--prodip-navy)', margin: '0 0 6px 0' }}>
            {activeTab === 'signin' ? 'Volunteer Portal Login' : 'New Volunteer Registration'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--prodip-muted)', margin: 0 }}>
            {activeTab === 'signin' 
              ? 'Sign in to access 1-Tap attendance, coordinator sheet, and profile.' 
              : 'Register your CUET student credentials to join Prodip as a volunteer.'}
          </p>
        </div>

        {/* TAB SWITCHER: SIGN IN vs SIGN UP */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '22px' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'signin' ? '#fff' : 'transparent',
              color: activeTab === 'signin' ? 'var(--prodip-navy)' : 'var(--prodip-muted)',
              boxShadow: activeTab === 'signin' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <LogIn size={15} /> Sign In
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setErrorMsg(null); setSuccessMsg(null); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'signup' ? '#fff' : 'transparent',
              color: activeTab === 'signup' ? 'var(--prodip-navy)' : 'var(--prodip-muted)',
              boxShadow: activeTab === 'signup' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <UserPlus size={15} /> Sign Up / Register
          </button>
        </div>

        {/* FEEDBACK BANNERS */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '12.5px',
            color: '#dc2626',
            background: '#fee2e2',
            padding: '12px 14px',
            borderRadius: '8px',
            marginBottom: '18px',
            lineHeight: 1.45
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '12.5px',
            color: '#166534',
            background: '#dcfce7',
            padding: '12px 14px',
            borderRadius: '8px',
            marginBottom: '18px',
            lineHeight: 1.45
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* TAB 1: SIGN IN FORM */}
        {activeTab === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="e.g. golamrabbanynb@gmail.com"
                required
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  border: '1px solid var(--prodip-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  border: '1px solid var(--prodip-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--prodip-crimson)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(185,28,28,0.25)',
                opacity: loading ? 0.7 : 1
              }}
            >
              <LogIn size={16} />
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* TAB 2: SIGN UP / REGISTRATION FORM */
          <form onSubmit={handleSignUp}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={signUpFullName}
                  onChange={(e) => setSignUpFullName(e.target.value)}
                  placeholder="e.g. Mahfuzur Rahman"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Student ID *
                </label>
                <input
                  type="text"
                  value={signUpStudentId}
                  onChange={(e) => setSignUpStudentId(e.target.value)}
                  placeholder="e.g. 2101104"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Department
                </label>
                <select
                  value={signUpDepartment}
                  onChange={(e) => setSignUpDepartment(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px', background: 'white' }}
                >
                  <option value="CSE">CSE</option>
                  <option value="EEE">EEE</option>
                  <option value="ME">ME</option>
                  <option value="Civil">Civil</option>
                  <option value="ETE">ETE</option>
                  <option value="BME">BME</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Batch
                </label>
                <input
                  type="text"
                  value={signUpBatch}
                  onChange={(e) => setSignUpBatch(e.target.value)}
                  placeholder="e.g. '21 or '22"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Email Address (CUET or Personal) *
              </label>
              <input
                type="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                placeholder="e.g. u2101104@student.cuet.ac.bd"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13.5px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--prodip-muted)', display: 'block', marginTop: '3px' }}>
                Tip: Must match the email registered on Prodip volunteer roster.
              </span>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={signUpPhone}
                onChange={(e) => setSignUpPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Create Password *
                </label>
                <input
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={signUpConfirmPassword}
                  onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'var(--prodip-navy)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(30,44,79,0.25)',
                opacity: loading ? 0.7 : 1
              }}
            >
              <UserPlus size={16} />
              {loading ? 'Registering Account...' : 'Register as Volunteer'}
            </button>
          </form>
        )}

        {/* BOTTOM HELP INFO */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--prodip-border)', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>
            Need roster addition or role updates?
          </span>
          <div style={{ fontSize: '12px', color: 'var(--prodip-navy)', fontWeight: 700, marginTop: '4px' }}>
            Contact Master Admin at <b>2101103@prodip.org</b>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--prodip-navy)',
            textDecoration: 'none',
            fontWeight: 700
          }}
        >
          <ArrowLeft size={14} /> Back to Homepage
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--prodip-muted)' }}>
        Loading authentication portal...
      </div>
    }>
      <AuthPortal />
    </Suspense>
  );
}
