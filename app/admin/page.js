'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { CUET_DEPARTMENTS } from '@/lib/cuetDepartments';
import QuickSwitcher from '@/components/QuickSwitcher';
import AuthGate from '@/components/AuthGate';
import { useToast } from '@/components/Toast';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import { formatClock, logDuration } from '@/lib/time';
import { ShieldCheck, Check, X, Users, BookOpen, UserPlus, Upload, Download, FileSpreadsheet, Search, Trash2 } from 'lucide-react';

export default function AdminPage() {
  const { toast, ToastHost } = useToast();
  const [activeVolunteer, setActiveVolunteer] = useState(null);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddVolunteerModalOpen, setIsAddVolunteerModalOpen] = useState(false);
  const [isBatchUploadModalOpen, setIsBatchUploadModalOpen] = useState(false);

  // Manual volunteer form
  const [newVolunteer, setNewVolunteer] = useState({
    student_id: '',
    full_name: '',
    email: '',
    department: 'CSE',
    batch: "'21",
    role_level: 2,
    target_classes: 20,
    designated_days: ['Sunday', 'Tuesday', 'Friday']
  });

  // Batch CSV upload state
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);

  const router = useRouter();

  useEffect(() => {
    initAdmin();
  }, []);

  const initAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const vol = await fetchCurrentVolunteer(session);
      if (vol) setActiveVolunteer(vol);
    }

    fetchPendingLogs();
    fetchVolunteers();
    fetchActivities();
  };

  const fetchPendingLogs = async () => {
    const { data } = await supabase.from('attendance_logs').select('*').eq('status', 'Pending').order('created_at', { ascending: false });
    if (data) setPendingLogs(data);
  };

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('volunteers').select('*').order('full_name');
    setVolunteers(data || []);
  };

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('title');
    if (data) setActivities(data);
  };

  // RLS-denied updates return no error but zero rows, so ask for the row back and verify.
  const decideLog = async (log, status) => {
    if (status === 'Approved' && !log.out_time) {
      return toast('This session has no out-time yet, so it cannot be approved.', 'error');
    }
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ status })
      .eq('id', log.id)
      .select('id');
    if (error || !data || data.length === 0) {
      return toast(error ? `Failed: ${error.message}` : 'Not allowed: only the Master Admin can approve or reject.', 'error', 7000);
    }
    toast(status === 'Approved' ? 'Attendance approved.' : 'Attendance rejected.', status === 'Approved' ? 'success' : 'info');
    fetchPendingLogs();
  };

  // Manual Volunteer Add
  const handleManualAddVolunteer = async () => {
    if (!newVolunteer.student_id.trim() || !newVolunteer.full_name.trim()) {
      return toast('Student ID and Full Name are required.', 'error');
    }

    const payload = {
      ...newVolunteer,
      student_id: newVolunteer.student_id.trim(),
      full_name: newVolunteer.full_name.trim(),
      email: newVolunteer.email.trim() || `${newVolunteer.student_id.trim()}@prodip.org`
    };

    const { error } = await supabase.from('volunteers').insert([payload]);
    if (error) {
      return toast(`Could not add volunteer: ${error.message}`, 'error', 7000);
    }

    toast(`Added ${payload.full_name} (${payload.student_id}).`, 'success');
    fetchVolunteers();
    setIsAddVolunteerModalOpen(false);
    setNewVolunteer({
      student_id: '',
      full_name: '',
      email: '',
      department: 'CSE',
      batch: "'21",
      role_level: 2,
      target_classes: 20,
      designated_days: ['Sunday', 'Tuesday', 'Friday']
    });
  };

  // CSV Batch Upload Parse
  const handleCSVFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        toast('CSV file appears empty or has only a header row.', 'error');
        return;
      }

      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
        if (row.length < 2) continue;

        const student_id = row[0] || '';
        const full_name = row[1] || '';
        const email = row[2] || `${student_id}@prodip.org`;
        const department = row[3] || 'General';
        const batch = row[4] || '';
        const role_level = parseInt(row[5]) || 2;
        const target_classes = parseInt(row[6]) || 20;
        const daysStr = row[7] || 'Sunday;Tuesday;Friday';
        const designated_days = daysStr.split(/[;:]/).map(d => d.trim()).filter(Boolean);

        if (student_id && full_name) {
          parsed.push({
            student_id,
            full_name,
            email,
            department,
            batch,
            role_level,
            target_classes,
            designated_days: designated_days.length > 0 ? designated_days : ['Sunday', 'Tuesday', 'Friday']
          });
        }
      }

      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  // Download Sample CSV Template
  const downloadCSVTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Student ID,Full Name,Email,Department,Batch,Role Level,Target Classes,Designated Days\n" +
      "2101104,Fahim Muntakim,u2101104@student.cuet.ac.bd,CSE,'21,2,20,Sunday;Tuesday;Friday\n" +
      "2101105,Sumaiya Akter,u2101105@student.cuet.ac.bd,EEE,'21,2,30,Friday\n" +
      "2401035,Rahim Khan,u2401035@student.cuet.ac.bd,Civil,'24,1,20,Tuesday;Friday\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "prodip_volunteers_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Parsed CSV into Database
  const handleImportBatch = async () => {
    if (csvPreview.length === 0) {
      return toast('Please select a valid CSV file with volunteer rows.', 'error');
    }
    setIsUploadingBatch(true);
    const { error } = await supabase.from('volunteers').upsert(csvPreview, { onConflict: 'student_id' });
    setIsUploadingBatch(false);

    if (error) {
      return toast(`Import failed: ${error.message}`, 'error', 7000);
    }

    toast(`Imported ${csvPreview.length} volunteers.`, 'success');
    fetchVolunteers();
    setIsBatchUploadModalOpen(false);
    setCsvPreview([]);
    setCsvFileName('');
  };

  const handleDeleteVolunteer = async (id, name) => {
    if (!confirm(`Remove ${name} from the roster? Their past attendance records are kept.`)) return;
    const { data, error } = await supabase.from('volunteers').delete().eq('student_id', id).select('student_id');
    if (error || !data || data.length === 0) {
      return toast(error ? `Could not remove: ${error.message}` : 'Not allowed to remove this volunteer.', 'error', 7000);
    }
    setVolunteers((prev) => prev.filter((v) => v.student_id !== id));
    toast(`${name} removed.`, 'info');
  };

  const filteredVolunteers = volunteers.filter(v =>
    v.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.department && v.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AuthGate minRoleLevel={6} requiredRoleName="System Administrator">
      <section>
        <QuickSwitcher />
        <ToastHost />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', paddingBottom: '14px', borderBottom: '2px solid var(--prodip-border)' }}>
        <div>
          <h2 style={{ fontSize: '22px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="var(--prodip-crimson)" /> PVMS Master Admin Panel
          </h2>
          <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
            System Administrator console for approving attendance submissions and managing volunteer roster data.
          </span>
        </div>
        <span style={{ fontSize: '12.5px', background: '#fee2e2', color: '#991b1b', padding: '5px 14px', borderRadius: '20px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          System Administrator
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* PENDING ATTENDANCE APPROVALS */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={18} color="var(--prodip-crimson)" /> Pending Attendance Approvals ({pendingLogs.length})
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Volunteer</th>
                  <th style={{ padding: '10px 12px' }}>Activity</th>
                  <th style={{ padding: '10px 12px' }}>Times</th>
                  <th style={{ padding: '10px 12px' }}>Credited To</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingLogs.length > 0 ? (
                  pendingLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td data-label="Date" style={{ padding: '12px' }}><b>{log.session_date}</b> <span style={{ fontSize: '11px', color: 'var(--prodip-muted)' }}>({log.day_of_week})</span></td>
                      <td data-label="Volunteer" style={{ padding: '12px' }}>{log.instructor_name} <br/><span style={{ fontSize: '11px', color: 'var(--prodip-muted)' }}>ID: {log.instructor_id}</span></td>
                      <td data-label="Activity" style={{ padding: '12px' }}>{log.activity_title}</td>
                      <td data-label="Time" style={{ padding: '12px' }}>
                        {formatClock(log.in_time)} → {log.out_time ? formatClock(log.out_time) : 'Ongoing'}
                        <div><b>{logDuration(log)}</b></div>
                      </td>
                      <td data-label="Credited To" style={{ padding: '12px' }}>{log.credited_to_id}</td>
                      <td data-label="Actions" style={{ padding: '12px', textAlign: 'right' }}>
                        <div className="row-actions">
                          <button
                            className="btn-row"
                            disabled={!log.out_time}
                            title={!log.out_time ? 'No out-time recorded yet' : ''}
                            style={{ background: log.out_time ? 'var(--prodip-olive)' : '#94a3b8', color: 'white' }}
                            onClick={() => decideLog(log, 'Approved')}
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            className="btn-row"
                            style={{ background: 'var(--prodip-crimson)', color: 'white' }}
                            onClick={() => decideLog(log, 'Rejected')}
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--prodip-muted)' }}>
                      No pending attendance logs requiring approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FULL VOLUNTEER DIRECTORY WITH MANUAL ADD & BATCH CSV UPLOAD */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> Volunteer Directory &amp; Roster Management ({volunteers.length})
              </h3>
              <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
                Add new volunteers manually or bulk import via CSV file.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search volunteers..."
                  style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
              <button
                onClick={() => setIsAddVolunteerModalOpen(true)}
                style={{ background: 'var(--prodip-navy)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UserPlus size={14} /> Add Volunteer
              </button>
              <button
                onClick={() => setIsBatchUploadModalOpen(true)}
                style={{ background: '#059669', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={14} /> Batch CSV Upload
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>Student ID</th>
                  <th style={{ padding: '10px 12px' }}>Full Name</th>
                  <th style={{ padding: '10px 12px' }}>Dept / Batch</th>
                  <th style={{ padding: '10px 12px' }}>Role Level</th>
                  <th style={{ padding: '10px 12px' }}>Target</th>
                  <th style={{ padding: '10px 12px' }}>Designated Days</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map(v => (
                  <tr key={v.student_id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                    <td data-label="Student ID" style={{ padding: '12px' }}><b>{v.student_id}</b></td>
                    <td data-label="Name" style={{ padding: '12px' }}>
                      <b>{v.full_name}</b>
                      <div style={{ fontSize: '11px', color: 'var(--prodip-muted)' }}>{v.email || '—'}</div>
                    </td>
                    <td data-label="Dept / Batch" style={{ padding: '12px' }}>{v.department || '—'} {v.batch || ''}</td>
                    <td data-label="Role" style={{ padding: '12px' }}>
                      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                        Level {v.role_level || 1}
                      </span>
                    </td>
                    <td data-label="Target" style={{ padding: '12px' }}><b>{v.target_classes || 20}</b></td>
                    <td data-label="Days" style={{ padding: '12px', fontSize: '12px' }}>
                      {Array.isArray(v.designated_days) && v.designated_days.length > 0 ? v.designated_days.join(', ') : '—'}
                    </td>
                    <td data-label="Actions" style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteVolunteer(v.student_id, v.full_name)}
                        style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACTIVITIES OVERVIEW */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '17px', color: 'var(--prodip-navy)', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} /> Active Activities ({activities.length})
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '14px' }}>Configured teaching and social mentorship activities.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {activities.map(a => (
              <span key={a.id} style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)', padding: '6px 12px', borderRadius: '16px', fontSize: '12.5px', fontWeight: 700, color: 'var(--prodip-navy)' }}>
                {a.title}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: MANUAL ADD VOLUNTEER ─── */}
      {isAddVolunteerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--prodip-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} /> Add Volunteer to Roster
              </h3>
              <button onClick={() => setIsAddVolunteerModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Student ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. 2101104"
                    value={newVolunteer.student_id}
                    onChange={e => setNewVolunteer({ ...newVolunteer, student_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Fahim Muntakim"
                    value={newVolunteer.full_name}
                    onChange={e => setNewVolunteer({ ...newVolunteer, full_name: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. u2101104@student.cuet.ac.bd"
                  value={newVolunteer.email}
                  onChange={e => setNewVolunteer({ ...newVolunteer, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Department</label>
                  <select
                    value={newVolunteer.department}
                    onChange={e => setNewVolunteer({ ...newVolunteer, department: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px', background: 'white' }}
                  >
                    {CUET_DEPARTMENTS.map((dept) => (
                      <option key={dept.value} value={dept.value}>{dept.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Batch</label>
                  <input
                    type="text"
                    placeholder="e.g. '21"
                    value={newVolunteer.batch}
                    onChange={e => setNewVolunteer({ ...newVolunteer, batch: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Role Level</label>
                  <select
                    value={newVolunteer.role_level}
                    onChange={e => setNewVolunteer({ ...newVolunteer, role_level: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value={1}>Level 1: Trainee</option>
                    <option value={2}>Level 2: Active Volunteer / Mentor</option>
                    <option value={3}>Level 3: Coordinator</option>
                    <option value={4}>Level 4: Senior Coordinator</option>
                    <option value={6}>Level 6: System Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Target Classes</label>
                  <input
                    type="number"
                    value={newVolunteer.target_classes}
                    onChange={e => setNewVolunteer({ ...newVolunteer, target_classes: parseInt(e.target.value) || 20 })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Designated Teaching Days</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' }}>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                    const isChecked = (newVolunteer.designated_days || []).includes(day);
                    return (
                      <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const cur = newVolunteer.designated_days || [];
                            if (e.target.checked) {
                              setNewVolunteer({ ...newVolunteer, designated_days: [...cur, day] });
                            } else {
                              setNewVolunteer({ ...newVolunteer, designated_days: cur.filter(d => d !== day) });
                            }
                          }}
                        />
                        {day.slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button
                  onClick={() => setIsAddVolunteerModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--prodip-border)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualAddVolunteer}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--prodip-navy)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  Save Volunteer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: BATCH CSV UPLOAD ─── */}
      {isBatchUploadModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '680px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--prodip-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#059669" /> Batch Upload Volunteers (CSV)
              </h3>
              <button onClick={() => setIsBatchUploadModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12.5px', color: '#166534' }}>
                <b>Need a CSV template?</b> Download the sample template with expected headers.
              </div>
              <button
                onClick={downloadCSVTemplate}
                style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={13} /> Sample CSV
              </button>
            </div>

            <div style={{ border: '2px dashed var(--prodip-border)', borderRadius: '10px', padding: '24px', textAlign: 'center', marginBottom: '18px', background: '#f8fafc' }}>
              <Upload size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--prodip-navy)', marginBottom: '4px' }}>
                {csvFileName ? `Selected: ${csvFileName}` : 'Choose CSV file to upload'}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', display: 'block', marginBottom: '12px' }}>
                Columns: Student ID, Full Name, Email, Department, Batch, Role Level, Target Classes, Designated Days
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVFileChange}
                style={{ fontSize: '13px' }}
              />
            </div>

            {csvPreview.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--prodip-navy)' }}>
                    Preview Parsed Volunteers ({csvPreview.length})
                  </h4>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Ready to import</span>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--prodip-border)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px' }}>ID</th>
                        <th style={{ padding: '6px 8px' }}>Name</th>
                        <th style={{ padding: '6px 8px' }}>Dept</th>
                        <th style={{ padding: '6px 8px' }}>Role</th>
                        <th style={{ padding: '6px 8px' }}>Target</th>
                        <th style={{ padding: '6px 8px' }}>Schedule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                          <td style={{ padding: '6px 8px' }}><b>{r.student_id}</b></td>
                          <td style={{ padding: '6px 8px' }}>{r.full_name}</td>
                          <td style={{ padding: '6px 8px' }}>{r.department}</td>
                          <td style={{ padding: '6px 8px' }}>Lvl {r.role_level}</td>
                          <td style={{ padding: '6px 8px' }}>{r.target_classes}</td>
                          <td style={{ padding: '6px 8px' }}>{(r.designated_days || []).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button
                onClick={() => { setIsBatchUploadModalOpen(false); setCsvPreview([]); setCsvFileName(''); }}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--prodip-border)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                Cancel
              </button>
              <button
                disabled={csvPreview.length === 0 || isUploadingBatch}
                onClick={handleImportBatch}
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: csvPreview.length > 0 ? '#059669' : '#94a3b8', color: 'white', cursor: csvPreview.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 700 }}
              >
                {isUploadingBatch ? 'Importing...' : `Import ${csvPreview.length} Volunteers`}
              </button>
            </div>
          </div>
        </div>
      )}
      </section>
    </AuthGate>
  );
}
