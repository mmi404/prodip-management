'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import LoginModal from '@/components/LoginModal';
import { User, Menu, X, Shield, ShieldCheck, LogIn, LogOut, Award, ChevronDown } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userRoleLevel, setUserRoleLevel] = useState(1);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    checkUserRole();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUserRole();
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoggedIn(true);
      const { data: vol } = await supabase
        .from('volunteers')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

      if (vol) {
        setUserRoleLevel(vol.role_level || 1);
        setActiveVolunteer(vol);
      } else {
        const { data: volByEmail } = await supabase
          .from('volunteers')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (volByEmail) {
          setUserRoleLevel(volByEmail.role_level || 1);
          setActiveVolunteer(volByEmail);
        } else {
          setUserRoleLevel(1);
          setActiveVolunteer({
            student_id: session.user.user_metadata?.student_id || session.user.email?.split('@')[0] || 'VOLUNTEER',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Volunteer',
            email: session.user.email,
            role_level: 1
          });
        }
      }
    } else {
      setIsLoggedIn(false);
      setUserRoleLevel(0);
      setActiveVolunteer(null);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setActiveVolunteer(null);
    setUserRoleLevel(0);
    closeMenu();
    router.push('/');
  };

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const getRoleBadge = (level) => {
    if (level >= 6) return { label: 'Admin', bg: '#fee2e2', color: '#991b1b' };
    if (level >= 4) return { label: 'Sr. Coord', bg: '#fef3c7', color: '#92400e' };
    if (level >= 3) return { label: 'Coord', bg: '#e0e7ff', color: '#3730a3' };
    return { label: 'Mentor', bg: '#dcfce7', color: '#166534' };
  };

  return (
    <>
      <header className="ribbon-bar">
        <Link href="/" className="ribbon-brand" onClick={closeMenu}>
          <div className="ribbon-logo-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8 6 6 9 6 12.5A6 6 0 0 0 18 12.5C18 9 16 6 12 2Z" fill="#E5A823"/>
              <rect x="10.5" y="18" width="3" height="4" rx="1" fill="#1E2C4F"/>
            </svg>
          </div>
          <div className="ribbon-title">
            <h1>প্রদীপ (Prodip)</h1>
            <span>স্বপ্ন বুননের একটি পথচলা · CUET</span>
          </div>
        </Link>

        <button
          className="mobile-nav-toggle"
          aria-label="Toggle Navigation Menu"
          onClick={toggleMenu}
        >
          {isOpen ? <X size={22} color="white" /> : <Menu size={22} color="white" />}
        </button>

        <nav className={`ribbon-nav ${isOpen ? 'is-open' : ''}`}>
          {/* 1. PUBLIC LINKS (Always visible) */}
          <Link
            href="/"
            className={`ribbon-link ${pathname === '/' ? 'active-tab' : ''}`}
            onClick={closeMenu}
          >
            Home
          </Link>

          {/* 2. MENTOR DASHBOARD (Visible to logged-in volunteers Level >= 1) */}
          {isLoggedIn && userRoleLevel >= 1 && (
            <Link
              href="/profile"
              className={`ribbon-link ${pathname === '/profile' ? 'active-tab' : ''}`}
              onClick={closeMenu}
            >
              Mentor Dashboard
            </Link>
          )}

          {/* 3. COORDINATOR SHEET (Role >= 3) */}
          {isLoggedIn && userRoleLevel >= 3 && (
            <Link
              href="/coordinator"
              className={`ribbon-link coord-pill ${pathname === '/coordinator' ? 'active-tab' : ''}`}
              onClick={closeMenu}
            >
              <Shield size={14} />
              Coordinator Sheet
            </Link>
          )}

          {/* 4. APPROVALS (Role >= 4) */}
          {isLoggedIn && userRoleLevel >= 4 && (
            <Link
              href="/approvals"
              className={`ribbon-link ${pathname === '/approvals' ? 'active-tab' : ''}`}
              onClick={closeMenu}
            >
              <Shield size={14} />
              Approvals
            </Link>
          )}

          {/* 5. VOLUNTEERS & ROLES (Role >= 6 Master Admin) */}
          {isLoggedIn && userRoleLevel >= 6 && (
            <Link
              href="/admin"
              className={`ribbon-link admin-pill ${pathname === '/admin' ? 'active-tab' : ''}`}
              onClick={closeMenu}
            >
              <ShieldCheck size={14} />
              Volunteers &amp; Roles
            </Link>
          )}

          {/* 6. ACTIVITIES (Public) */}
          <Link
            href="/activities"
            className={`ribbon-link ${pathname === '/activities' ? 'active-tab' : ''}`}
            onClick={closeMenu}
          >
            Activities
          </Link>

          {/* 7. MILESTONES & CERTS (Protected to staff/coordinators Level >= 3) */}
          {isLoggedIn && userRoleLevel >= 3 && (
            <Link
              href="/audit"
              className={`ribbon-link cert-badge-nav ${pathname === '/audit' ? 'active-tab' : ''}`}
              style={{ background: 'var(--prodip-olive)', color: 'white', padding: '6px 14px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={closeMenu}
            >
              🏅 Milestones &amp; Certs
            </Link>
          )}

          {/* 8. AUTHENTICATION DOOR (Sign In or User Profile Chip) */}
          {!isLoggedIn ? (
            <button
              onClick={() => { closeMenu(); setIsLoginModalOpen(true); }}
              className="ribbon-link"
              style={{
                background: 'var(--prodip-gold)',
                color: '#1e2c4f',
                padding: '7px 16px',
                borderRadius: '20px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '8px',
                boxShadow: '0 2px 8px rgba(229,168,35,0.3)'
              }}
            >
              <LogIn size={15} />
              Sign In
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: '6px', padding: '4px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px' }}>
              <Link
                href="/profile"
                onClick={closeMenu}
                style={{
                  textDecoration: 'none',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  padding: '2px 8px'
                }}
              >
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--prodip-gold)', color: '#1e2c4f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                  {activeVolunteer?.full_name?.charAt(0) || 'V'}
                </div>
                <span>{activeVolunteer?.full_name?.split(' ')[0] || 'User'}</span>
                <span style={{
                  background: getRoleBadge(userRoleLevel).bg,
                  color: getRoleBadge(userRoleLevel).color,
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  {getRoleBadge(userRoleLevel).label}
                </span>
              </Link>

              <button
                onClick={handleSignOut}
                title="Sign Out"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fee2e2',
                  padding: '5px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '11.5px',
                  gap: '4px',
                  fontWeight: 700
                }}
              >
                <LogOut size={13} />
                <span className="signout-text">Logout</span>
              </button>
            </div>
          )}
        </nav>
      </header>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => checkUserRole()}
      />
    </>
  );
}
