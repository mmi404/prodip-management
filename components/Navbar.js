'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, User, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
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
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <nav className={`ribbon-nav ${isOpen ? 'is-open' : ''}`}>
        <Link
          href="/"
          className={`ribbon-link ${pathname === '/' ? 'active-tab' : ''}`}
          onClick={closeMenu}
        >
          Our Activities
        </Link>
        <Link
          href="/about"
          className={`ribbon-link ${pathname === '/about' ? 'active-tab' : ''}`}
          onClick={closeMenu}
        >
          About Us
        </Link>
        <Link
          href="/donate"
          className={`ribbon-link donate-pill ${pathname === '/donate' ? 'active-tab' : ''}`}
          onClick={closeMenu}
        >
          <Heart size={14} />
          Donate
        </Link>
        <Link
          href="/profile"
          className={`ribbon-link profile-highlight-pill ${pathname === '/profile' ? 'active-tab' : ''}`}
          onClick={closeMenu}
        >
          <User size={14} />
          My Profile
        </Link>
      </nav>
    </header>
  );
}
