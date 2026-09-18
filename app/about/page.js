import { GraduationCap } from 'lucide-react';

export default function AboutPage() {
  return (
    <section>
      <div className="card" style={{ lineHeight: 1.7, padding: '36px' }}>
        <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GraduationCap size={24} color="var(--prodip-crimson)" /> আমাদের সম্পর্কে (About Us)
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--prodip-text)' }}>
          <b>প্রদীপ (Prodip)</b> চট্টগ্রাম প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয় (CUET)-এর শিক্ষার্থীদের দ্বারা পরিচালিত একটি অলাভজনক সামাজিক ও শিক্ষামূলক সংগঠন। প্রান্তিক ও সুবিধাবঞ্চিত শিশুদের শিক্ষাবিমুখতা দূর করে তাদেরকে স্বাবলম্বী নাগরিক হিসেবে গড়ে তোলার লক্ষ্যে আমরা নিয়োজিত।
        </p>
      </div>
    </section>
  );
}
