import { Heart } from 'lucide-react';

export default function DonatePage() {
  return (
    <section>
      <div className="card" style={{ textAlign: 'center', maxWidth: '650px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ color: 'var(--prodip-crimson)', marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
          <Heart size={42} />
        </div>
        <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', marginBottom: '10px' }}>প্রদীপ অনুদান তহবিল</h2>
        <p style={{ fontSize: '14px', color: 'var(--prodip-muted)', marginBottom: '24px' }}>আপনার সামর্থ্য অনুযায়ী সামান্য সহায়তা নিশ্চিত করতে পারে একটি শিশুর স্কুলের বেতন, খাতা-কলম ও পোশাক।</p>
        <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '12px', fontSize: '14px', textAlign: 'left', border: '1px solid var(--prodip-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748b' }}>বিকাশ / নগদ (ব্যক্তিগত):</span>
            <b style={{ color: 'var(--prodip-navy)' }}>01581461058</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>রেফারেন্স হিসেবে দিন:</span>
            <b>Prodip Donation</b>
          </div>
        </div>
      </div>
    </section>
  );
}
