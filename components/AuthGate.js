'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import LoginModal from '@/components/LoginModal';
import { Lock, ShieldAlert, LogIn, ArrowLeft } from 'lucide-react';

export default function AuthGate({ minRoleLevel = 1, requiredRoleName = 'Volunteer', children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [volunteer, setVolunteer] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });

    return () => subscription.unsubscribe();
  }, [minRoleLevel]);

  const checkAccess = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setSession(null);
      setVolunteer(null);
      setLoading(false);
      return;
    }

    setSession(session);

    // Fetch volunteer profile to verify role level
    const { data: vol } = await supabase
      .from('volunteers')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .single();

    if (vol) {
      setVolunteer(vol);
    } else {
      const { data: volByEmail } = await supabase
        .from('volunteers')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (volByEmail) {
        setVolunteer(volByEmail);
      } else {
        setVolunteer({
          student_id: session.user.user_metadata?.student_id || session.user.email?.split('@')[0] || 'VOLUNTEER',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Volunteer',
          email: session.user.email,
          role_level: 1
        });
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--prodip-navy)' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(30,44,79,0.15)',
            borderTopColor: 'var(--prodip-crimson)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--prodip-muted)' }}>Verifying access credentials...</p>
        </div>
      </div>
    );
  }

  // CASE 1: Not Logged In
  if (!session) {
    return (
      <div style={{ maxWidth: '480px', margin: '60px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto'
          }}>
            <Lock size={30} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--prodip-navy)', marginBottom: '8px' }}>
            Authentication Required
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--prodip-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
            This page is restricted to registered Prodip volunteers and staff. Please sign in to access this portal.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                background: 'var(--prodip-crimson)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(185,28,28,0.2)'
              }}
            >
              <LogIn size={16} /> Sign In to Access
            </button>

            <Link
              href="/"
              style={{
                background: '#f1f5f9',
                color: 'var(--prodip-navy)',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={14} /> Back to Homepage
            </Link>
          </div>
        </div>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={() => checkAccess()}
        />
      </div>
    );
  }

  // CASE 2: Logged in but Insufficient Role Level
  const currentLevel = volunteer?.role_level || 1;
  if (currentLevel < minRoleLevel) {
    return (
      <div style={{ maxWidth: '520px', margin: '60px auto', padding: '0 16px' }}>
        <div className="card" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#fef3c7',
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto'
          }}>
            <ShieldAlert size={32} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--prodip-navy)', marginBottom: '8px' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--prodip-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
            You are signed in as <b>{volunteer?.full_name || session.user.email}</b> (Level {currentLevel}).
            This section requires <b>{requiredRoleName} (Level {minRoleLevel}+)</b> privileges.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/profile"
              style={{
                background: 'var(--prodip-navy)',
                color: 'white',
                textDecoration: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700
              }}
            >
              Go to Mentor Dashboard
            </Link>
            <Link
              href="/"
              style={{
                background: '#f1f5f9',
                color: 'var(--prodip-navy)',
                textDecoration: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700
              }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // CASE 3: Authenticated & Authorized
  return children;
}
