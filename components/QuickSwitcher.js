'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { User, Shield, ShieldCheck } from 'lucide-react';

export default function QuickSwitcher() {
  const [roleLevel, setRoleLevel] = useState(1);
  const pathname = usePathname();

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: vol } = await supabase.from('volunteers').select('role_level').eq('auth_user_id', session.user.id).single();
      if (vol) setRoleLevel(vol.role_level || 1);
    }
  };

  if (roleLevel < 3) return null;

  return (
    <div className="quick-switcher-bar">
      <span className="quick-switcher-label">Navigation:</span>

      <Link
        href="/profile"
        className={`quick-switcher-link ${pathname === '/profile' ? 'active' : ''}`}
      >
        <User size={14} /> My Profile
      </Link>

      {roleLevel >= 3 && (
        <Link
          href="/coordinator"
          className={`quick-switcher-link ${pathname === '/coordinator' ? 'active' : ''}`}
        >
          <Shield size={14} /> Coordinator Desk
        </Link>
      )}

      {roleLevel >= 6 && (
        <Link
          href="/admin"
          className={`quick-switcher-link ${pathname === '/admin' ? 'active' : ''}`}
        >
          <ShieldCheck size={14} /> Master Admin Panel
        </Link>
      )}
    </div>
  );
}
