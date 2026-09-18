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
    if (data) setActivities(data);
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
          background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
          border: '1px solid var(--prodip-border)',
          padding: '16px 20px',
          borderRadius: '14px',
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
              Sign in to record your 1-tap class attendance, check streaks, and access coordinator sheets.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              style={{
                background: 'var(--prodip-navy)',
                color: 'white',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <LogIn size={14} /> Volunteer Sign In
            </button>
            <Link
              href="/activities"
              style={{
                background: 'transparent',
                color: 'var(--prodip-navy)',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
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

      <h2 className="section-title" style={{ fontSize: '20px', color: 'var(--prodip-navy)', marginBottom: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BookOpen size={18} color="var(--prodip-olive)" />
        আমাদের নিয়মিত কার্যক্রমসমূহ
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginTop: '18px' }}>
        {activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="card" style={{ padding: '24px', lineHeight: 1.6 }}>
              <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', marginBottom: '8px' }}>{act.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--prodip-muted)' }}>{act.notes || 'Public volunteer education and mentorship activity.'}</p>
            </div>
          ))
        ) : (
          <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--prodip-muted)' }}>
            Loading regular activities...
          </div>
        )}
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => checkSession()}
      />
    </section>
  );
}
