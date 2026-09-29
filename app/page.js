'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import SubstituteNotificationBanner from '@/components/SubstituteNotificationBanner';
import OneTapCheckInWidget from '@/components/OneTapCheckInWidget';
import LoginModal from '@/components/LoginModal';
import { BookOpen, LogIn, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const [activities, setActivities] = useState([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchActivities();
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);
  };

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').eq('status', 'Active').order('title');
    setActivities(data || []);
    setLoaded(true);
  };

  return (
    <section>
      <PushNotificationPrompt />
      <SubstituteNotificationBanner />

      {/* 1-TAP CHECK-IN WIDGET: STRICTLY FOR SCHEDULED VOLUNTEERS ON CLASS / SUBSTITUTE DAYS */}
      <OneTapCheckInWidget onOpenLoginModal={() => setIsLoginModalOpen(true)} />

      {/* PUBLIC WELCOME BANNER */}
      <div className="hero-banner">
        <h2>একটি সময়, একটি শিশুর সুন্দর আগামী।</h2>
        <p>আমরা সুবিধাবঞ্চিত শিশুদের মৌলিক শিক্ষা, মানবিক মূল্যবোধ ও সহশিক্ষা কার্যক্রমের মাধ্যমে স্বপ্নবান মানুষ হিসেবে গড়ে তোলার প্রত্যয়ে কাজ করছি।</p>
      </div>

      {/* GUEST PORTAL SIGN IN CALLOUT (Shown only when logged out) */}
      {!isLoggedIn && (
        <div style={{
          background: 'var(--prodip-card)',
          border: '1px solid var(--prodip-border)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <b style={{ color: 'var(--prodip-navy)', fontSize: '14px', display: 'block' }}>
              Are you a registered Prodip volunteer or coordinator?
            </b>
            <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
              Sign in to record your 1-tap class attendance, check streaks, and access your panels.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="btn-primary-action"
              style={{ background: 'var(--prodip-navy)', padding: '9px 18px', minHeight: 'auto', fontSize: '13px' }}
            >
              <LogIn size={14} /> Volunteer Sign In
            </button>
            <Link
              href="/activities"
              style={{
                background: 'transparent',
                color: 'var(--prodip-navy)',
                textDecoration: 'none',
                padding: '9px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Explore Activities <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      <h2 className="section-title" style={{ fontSize: '18px', color: 'var(--prodip-navy)', marginBottom: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BookOpen size={17} color="var(--prodip-olive)" />
        আমাদের নিয়মিত কার্যক্রমসমূহ
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '18px' }}>
        {activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="card" style={{ padding: '24px', lineHeight: 1.6 }}>
              <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', marginBottom: '8px' }}>{act.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--prodip-muted)' }}>{act.notes || 'Public volunteer education and mentorship activity.'}</p>
            </div>
          ))
        ) : (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--prodip-muted)' }}>
            {loaded ? 'No activities have been published yet.' : 'Loading regular activities...'}
          </div>
        )}
      </div>

      {/* No role-based button grid here on purpose — a logged-in volunteer's panels
          live one tap away in the profile menu (desktop) or the bottom tab bar
          (phone), so this page doesn't repeat the same links a second time. */}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => checkSession()}
      />
    </section>
  );
}
