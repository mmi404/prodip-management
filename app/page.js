'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import SubstituteNotificationBanner from '@/components/SubstituteNotificationBanner';
import OneTapCheckInWidget from '@/components/OneTapCheckInWidget';
import LoginModal from '@/components/LoginModal';
import { BookOpen } from 'lucide-react';

export default function HomePage() {
  const [activities, setActivities] = useState([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').eq('status', 'Active').order('title');
    if (data) setActivities(data);
  };

  return (
    <section>
      <PushNotificationPrompt />
      <SubstituteNotificationBanner />

      {/* ZERO-FRICTION 1-TAP CIRCULAR BUTTON WIDGET ON HOMESCREEN */}
      <OneTapCheckInWidget onOpenLoginModal={() => setIsLoginModalOpen(true)} />

      <div className="hero-banner">
        <h2>একটি সময়, একটি শিশুর সুন্দর আগামী।</h2>
        <p>আমরা সুবিধাবঞ্চিত শিশুদের মৌলিক শিক্ষা, মানবিক মূল্যবোধ ও সহশিক্ষা কার্যক্রমের মাধ্যমে স্বপ্নবান মানুষ হিসেবে গড়ে তোলার প্রত্যয়ে কাজ করছি।</p>
      </div>

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
        onSuccess={() => setIsLoginModalOpen(false)}
      />
    </section>
  );
}
