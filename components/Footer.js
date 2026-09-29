import Link from 'next/link';
import { Heart, GraduationCap, BookOpen } from 'lucide-react';

// About/Donate carry real org content but aren't part of any daily workflow,
// so they live down here rather than competing with Home/Activities up top.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <Link href="/about" className="site-footer-link"><GraduationCap size={14} /> About Prodip</Link>
        <Link href="/activities" className="site-footer-link"><BookOpen size={14} /> Activities</Link>
        <Link href="/donate" className="site-footer-link"><Heart size={14} /> Donate</Link>
      </div>
      <div className="site-footer-meta">
        © {new Date().getFullYear()} প্রদীপ (Prodip) · CUET Volunteer Management System
      </div>
    </footer>
  );
}
