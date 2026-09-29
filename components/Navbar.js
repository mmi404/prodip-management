'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import LoginModal from '@/components/LoginModal';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import {
  User, Menu, X, Shield, ShieldCheck, LogIn, LogOut,
  Home, CheckSquare, ArrowRightLeft, MoreHorizontal, Award, BookOpen, ChevronDown
} from 'lucide-react';

const ROLE_LABEL = (level) => {
  if (level >= 6) return 'Master Admin';
  if (level >= 4) return 'Senior Coordinator';
  if (level >= 3) return 'Coordinator';
  return 'Volunteer';
};

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userRoleLevel, setUserRoleLevel] = useState(1);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef(null);

  useEffect(() => {
    setIsOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Stop the page scrolling behind the open drawer.
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    checkUserRole();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUserRole();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close the desktop dropdown on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const checkUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoggedIn(false);
      setUserRoleLevel(0);
      setActiveVolunteer(null);
      return;
    }
    setIsLoggedIn(true);
    const vol = await fetchCurrentVolunteer(session);
    setUserRoleLevel(vol.role_level || 1);
    setActiveVolunteer(vol);
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

  const toggleMenu = () => setIsOpen((v) => !v);
  const closeMenu = () => {
    setIsOpen(false);
    setMenuOpen(false);
  };

  // One list of destinations, gated by role — used by the desktop dropdown,
  // the mobile drawer, AND the bottom tab bar's "more" set, so they can't drift apart.
  const menuLinks = [
    { href: '/profile', label: 'Mentor Dashboard', icon: <User size={16} /> },
    { href: '/substitute', label: 'Substitute Requests', icon: <ArrowRightLeft size={16} /> },
    ...(userRoleLevel >= 3 ? [{ href: '/coordinator', label: 'Coordinator Sheet', icon: <Shield size={16} /> }] : []),
    ...(userRoleLevel >= 4 ? [{ href: '/approvals', label: 'Approvals', icon: <CheckSquare size={16} /> }] : []),
    ...(userRoleLevel >= 3 ? [{ href: '/audit', label: 'Milestones & Certs', icon: <Award size={16} /> }] : []),
    ...(userRoleLevel >= 6 ? [{ href: '/admin', label: 'Volunteers & Roles', icon: <ShieldCheck size={16} /> }] : [])
  ];

  // Bottom tabs on phones: the 3 most-used destinations, by role.
  const tabs = [
    { href: '/', label: 'Home', icon: <Home size={20} /> },
    { href: '/profile', label: 'Dashboard', icon: <User size={20} /> },
    ...(userRoleLevel >= 3 ? [{ href: '/coordinator', label: 'Sheet', icon: <Shield size={20} /> }] : [{ href: '/substitute', label: 'Substitute', icon: <ArrowRightLeft size={20} /> }]),
    ...(userRoleLevel >= 6
      ? [{ href: '/admin', label: 'Admin', icon: <ShieldCheck size={20} /> }]
      : userRoleLevel >= 4
        ? [{ href: '/approvals', label: 'Approvals', icon: <CheckSquare size={20} /> }]
        : [])
  ];

  const initial = activeVolunteer?.full_name?.charAt(0) || 'V';
  const firstName = activeVolunteer?.full_name?.split(' ')[0] || 'Account';

  // ── DESKTOP ONLY: avatar trigger + click-to-open dropdown. Entirely hidden
  // below 860px by CSS, so it never needs to double as the mobile menu. ──
  const ProfileMenu = () => (
    <div className="nav-user" ref={menuRef}>
      <button
        type="button"
        className="nav-user-trigger"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className="nav-avatar">{initial}</span>
        <span className="nav-user-name">{firstName}</span>
        <ChevronDown size={14} style={{ opacity: 0.75 }} />
      </button>

      {menuOpen && (
        <>
          <div className="nav-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="nav-dropdown" role="menu">
            <div className="nav-dropdown-header">
              <div className="nav-dropdown-name">{activeVolunteer?.full_name || 'Volunteer'}</div>
              <div className="nav-dropdown-meta">{ROLE_LABEL(userRoleLevel)} · ID {activeVolunteer?.student_id || '—'}</div>
            </div>

            {menuLinks.map((l) => (
              <Link key={l.href} href={l.href} className="nav-dropdown-item" onClick={closeMenu}>
                {l.icon} {l.label}
              </Link>
            ))}

            <div className="nav-dropdown-divider" />
            <button type="button" className="nav-dropdown-item danger" onClick={handleSignOut}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ── MOBILE ONLY: one flat, always-rendered list (no hidden trigger to
  // click, no state gate) — hidden on desktop purely by CSS. ──
  const MobileMenu = () => (
    <div className="mobile-menu">
      <Link href="/" className={`mobile-menu-item ${pathname === '/' ? 'active' : ''}`} onClick={closeMenu}>
        <Home size={16} /> Home
      </Link>
      <Link href="/activities" className={`mobile-menu-item ${pathname === '/activities' ? 'active' : ''}`} onClick={closeMenu}>
        <BookOpen size={16} /> Activities
      </Link>

      {isLoggedIn ? (
        <>
          <div className="mobile-menu-divider" />
          <div className="mobile-menu-identity">
            {activeVolunteer?.full_name || 'Volunteer'} · {ROLE_LABEL(userRoleLevel)}
          </div>
          {menuLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`mobile-menu-item ${pathname === l.href ? 'active' : ''}`} onClick={closeMenu}>
              {l.icon} {l.label}
            </Link>
          ))}
          <div className="mobile-menu-divider" />
          <button type="button" className="mobile-menu-item danger" onClick={handleSignOut}>
            <LogOut size={16} /> Sign Out
          </button>
        </>
      ) : (
        <button
          type="button"
          className="mobile-menu-item mobile-menu-signin"
          onClick={() => { closeMenu(); setIsLoginModalOpen(true); }}
        >
          <LogIn size={16} /> Sign In
        </button>
      )}
    </div>
  );

  return (
    <>
      <header className="ribbon-bar">
        <Link href="/" className="ribbon-brand" onClick={closeMenu}>
          <div className="ribbon-logo-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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

        {isOpen && <div className="mobile-nav-backdrop" onClick={closeMenu} />}

        <nav className={`ribbon-nav ${isOpen ? 'is-open' : ''}`}>
          {/* DESKTOP: a short, flat, always-the-same link row + the avatar dropdown. */}
          <div className="ribbon-links">
            <Link href="/" className={`ribbon-link ${pathname === '/' ? 'active-tab' : ''}`} onClick={closeMenu}>
              Home
            </Link>
            <Link href="/activities" className={`ribbon-link ${pathname === '/activities' ? 'active-tab' : ''}`} onClick={closeMenu}>
              Activities
            </Link>
          </div>

          <div className="ribbon-actions">
            {!isLoggedIn ? (
              <button onClick={() => { closeMenu(); setIsLoginModalOpen(true); }} className="btn-signin">
                <LogIn size={14} /> Sign In
              </button>
            ) : (
              <ProfileMenu />
            )}
          </div>

          {/* MOBILE: its own independent list — see MobileMenu above. */}
          <MobileMenu />
        </nav>
      </header>

      {/* MOBILE BOTTOM TAB BAR — the main destinations are always one tap away on a phone */}
      {isLoggedIn && (
        <nav className="mobile-tabbar" aria-label="Quick navigation">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={`mobile-tab ${pathname === t.href ? 'active' : ''}`}>
              {t.icon}
              <span>{t.label}</span>
            </Link>
          ))}
          <button type="button" className={`mobile-tab ${isOpen ? 'active' : ''}`} onClick={() => { setIsOpen(!isOpen); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </nav>
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => checkUserRole()}
      />
    </>
  );
}
