'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BookOpen, Search, CheckCircle } from 'lucide-react';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    // Only Active activities are public; the old code also invented three fake ones when the table was empty.
    const { data } = await supabase.from('activities').select('*').eq('status', 'Active').order('title');
    setActivities(data || []);
    setLoaded(true);
  };

  const filtered = activities.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.category && a.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <section>

      <div className="page-head">
        <div className="page-head-main">
          <div className="page-head-icon" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success-fg)' }}>
            <BookOpen size={21} />
          </div>
          <div>
            <h2 className="page-head-title">Prodip Curriculum &amp; Volunteer Activities</h2>
            <p className="page-head-subtitle">Regular educational and social development programs conducted by CUET student volunteers.</p>
          </div>
        </div>

        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activities..."
            style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '20px' }}>
        {filtered.map((act) => (
          <div key={act.id} className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="badge badge-info">{act.category || 'General Activity'}</span>
              <span className="badge badge-success"><CheckCircle size={12} /> {act.status || 'Active'}</span>
            </div>

            <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '8px' }}>
              {act.title}
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--prodip-muted)', lineHeight: 1.6 }}>
              {act.notes || 'Public volunteer education and mentorship activity.'}
            </p>
          </div>
        ))}
      </div>

      {loaded && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--prodip-muted)' }}>
          {activities.length === 0 ? 'No activities have been published yet.' : 'No activity matches your search.'}
        </div>
      )}
    </section>
  );
}
