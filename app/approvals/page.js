'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthGate from '@/components/AuthGate';
import { useToast } from '@/components/Toast';
import { fetchCurrentVolunteer } from '@/lib/volunteer';
import { formatClock, logDuration } from '@/lib/time';
import { Shield, Check, X, Users, Search, Edit3, PlusCircle, UserPlus, Upload, Download, FileSpreadsheet } from 'lucide-react';

export default function ApprovalsPage() {
  const { toast, ToastHost } = useToast();
  const [roleLevel, setRoleLevel] = useState(0);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'mentors'
  const [filterStatus, setFilterStatus] = useState('Pending'); // 'Pending' | 'Approved' | 'Rejected' | 'All'
  const [allLogs, setAllLogs] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddVolunteerModalOpen, setIsAddVolunteerModalOpen] = useState(false);
  const [isBatchUploadModalOpen, setIsBatchUploadModalOpen] = useState(false);
  const [isEditMentorModalOpen, setIsEditMentorModalOpen] = useState(false);
  const [editingMentor, setEditingMentor] = useState(null);

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
    initApprovals();
  }, []);

  const initApprovals = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const vol = await fetchCurrentVolunteer(session);
      setRoleLevel(vol?.role_level || 0);
    }
    fetchLogs();
    fetchVolunteers();
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('attendance_logs').select('*').order('session_date', { ascending: false });
    setAllLogs(data || []);
  };

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('volunteers').select('*').order('full_name');
    setVolunteers(data || []);
  };

  // A Supabase update that RLS denies returns NO error and zero rows, so we ask for the
  // updated row back (.select) and treat "nothing came back" as a failure instead of
  // pretending the approval worked.
  const decide = async (log, status) => {
    if (status === 'Approved' && !log.out_time) {
      return toast('This session has no out-time yet, so it cannot be approved. Ask the coordinator to fix it.', 'error');
    }
    const { data, error } = await supabase
      .from('attendance_logs')
      .update({ status })
      .eq('id', log.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return toast(
        error ? `Failed: ${error.message}` : 'Not allowed: your role cannot approve or reject attendance. Check that the Supabase migration was run.',
        'error',
        7000
      );
    }
    setAllLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, status } : l)));
    toast(status === 'Approved' ? 'Approved and credited.' : 'Rejected.', status === 'Approved' ? 'success' : 'info');
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
      "2101104,Fahim Muntakim,u2101104@student.cuet.ac.bd,CSE,'21,2,36,Sunday;Tuesday;Friday\n" +
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

  // Save Edited Mentor
  const handleSaveEditMentor = async () => {
    if (!editingMentor) return;
    const { data, error } = await supabase.from('volunteers').update({
      full_name: editingMentor.full_name,
      email: editingMentor.email,
      role_level: parseInt(editingMentor.role_level) || 2,
      target_classes: parseInt(editingMentor.target_classes) || 20,
      designated_days: editingMentor.designated_days
    }).eq('student_id', editingMentor.student_id).select('student_id');

    if (error || !data || data.length === 0) {
      return toast(error ? `Update failed: ${error.message}` : 'Not allowed: only the Master Admin can edit volunteers.', 'error', 7000);
    }

    toast(`Updated ${editingMentor.full_name}.`, 'success');
    fetchVolunteers();
    setIsEditMentorModalOpen(false);
    setEditingMentor(null);
  };

  const filteredLogs = allLogs.filter(log => {
    if (filterStatus === 'All') return true;
    return log.status === filterStatus;
  });

  const pendingCount = allLogs.filter(l => l.status === 'Pending').length;

  const filteredVolunteers = volunteers.filter(v =>
    v.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AuthGate minRoleLevel={4} requiredRoleName="Senior Coordinator">
      <section>
        <ToastHost />

      {/* TOP HEADER & TAB BAR */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px 24px' }}>
        <div className="page-head" style={{ marginBottom: '16px' }}>
          <div className="page-head-main">
            <div className="page-head-icon" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info-fg)' }}>
              <Shield size={21} />
            </div>
            <div>
              <h2 className="page-head-title">Attendance Approval Queue</h2>
              <p className="page-head-subtitle">Verification queue for volunteer participation and streak accreditation.</p>
            </div>
          </div>

          <div className="segmented">
            {['Pending', 'Approved', 'Rejected', 'All'].map((status) => (
              <button
                key={status}
                className={`segmented-btn ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status} {status === 'Pending' ? `(${pendingCount})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* SECONDARY NAVIGATION TABS */}
        <div className="segmented" style={{ background: 'transparent', border: 'none', padding: 0 }}>
          <button onClick={() => setActiveTab('queue')} className={`segmented-btn ${activeTab === 'queue' ? 'active dark' : ''}`}>
            📋 Submissions Queue ({pendingCount})
          </button>
          <button onClick={() => setActiveTab('mentors')} className={`segmented-btn ${activeTab === 'mentors' ? 'active dark' : ''}`}>
            👥 Manage Mentors &amp; Teacher Data
          </button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        /* APPROVAL QUEUE TABLE */
        <div className="card" style={{ padding: '24px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--prodip-muted)', marginBottom: '18px' }}>
            Approving a record officially credits the class to the mentor&apos;s milestone progress bar and streak.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--prodip-border)', color: '#64748b' }}>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>SESSION DATE</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ACTIVITY</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>MENTOR CREDITED</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ATTENDEE TYPE</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>TIME &amp; HOURS</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>NOTES</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>STATUS</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>APPROVAL ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td data-label="Date" style={{ padding: '14px 12px' }}>
                        <b>{log.session_date}</b>
                        <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)', display: 'block' }}>{log.day_of_week}</span>
                      </td>
                      <td data-label="Activity" style={{ padding: '14px 12px' }}>
                        <span style={{ background: '#f3e8ff', color: '#6b21a8', fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px' }}>
                          {log.activity_title}
                        </span>
                      </td>
                      <td data-label="Mentor" style={{ padding: '14px 12px' }}>
                        <b>{log.replacement_name || log.instructor_name}</b>
                        <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)', display: 'block' }}>ID: {log.credited_to_id || log.instructor_id}</span>
                      </td>
                      <td data-label="Type" style={{ padding: '14px 12px' }}>
                        {log.replacement_name ? (
                          <span className="badge badge-info">🔀 Covering for {log.instructor_name}</span>
                        ) : (
                          <span className="badge badge-success">👤 Attended Directly</span>
                        )}
                      </td>
                      <td data-label="Time" style={{ padding: '14px 12px' }}>
                        <div style={{ fontSize: '12px', color: '#475569' }}>In: <b>{formatClock(log.in_time)}</b></div>
                        <div style={{ fontSize: '12px', color: '#475569' }}>Out: <b>{log.out_time ? formatClock(log.out_time) : 'Ongoing'}</b></div>
                        <b style={{ fontSize: '13px', color: log.out_time ? 'var(--prodip-navy)' : '#b45309' }}>{logDuration(log)}</b>
                      </td>
                      <td data-label="Notes" style={{ padding: '14px 12px', color: 'var(--prodip-muted)', fontSize: '12.5px' }}>
                        {log.topic_covered || 'No remarks'}
                      </td>
                      <td data-label="Status" style={{ padding: '14px 12px' }}>
                        <span className={`badge ${log.status === 'Approved' ? 'badge-success' : log.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {log.status === 'Pending' ? '⌛ Pending' : log.status}
                        </span>
                      </td>
                      <td data-label="Actions" style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {log.status === 'Pending' ? (
                          <div className="row-actions">
                            <button
                              className="btn-row"
                              disabled={!log.out_time}
                              title={!log.out_time ? 'No out-time recorded yet' : ''}
                              onClick={() => decide(log, 'Approved')}
                              style={{ background: !log.out_time ? '#94a3b8' : 'var(--status-success-solid)', color: 'white' }}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              className="btn-row"
                              onClick={() => decide(log, 'Rejected')}
                              style={{ background: 'var(--status-danger-solid)', color: 'white' }}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="badge badge-neutral">Verified</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--prodip-muted)' }}>
                      No {filterStatus.toLowerCase()} attendance submissions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MENTOR DATA MANAGEMENT TABLE */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800 }}>Mentor &amp; Teacher Directory</h3>
              <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Senior Coordinators can add, batch upload, and manage mentor designated days, target classes, and roles.</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mentor..."
                  style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
                />
              </div>
              <button onClick={() => setIsAddVolunteerModalOpen(true)} className="btn-row" style={{ background: 'var(--prodip-navy)', color: 'white' }}>
                <UserPlus size={14} /> Add Volunteer
              </button>
              <button onClick={() => setIsBatchUploadModalOpen(true)} className="btn-row" style={{ background: 'var(--status-success-solid)', color: 'white' }}>
                <Upload size={14} /> Batch CSV Upload
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                  <th style={{ padding: '12px' }}>STUDENT ID</th>
                  <th style={{ padding: '12px' }}>VOLUNTEER NAME</th>
                  <th style={{ padding: '12px' }}>ROLE LEVEL</th>
                  <th style={{ padding: '12px' }}>TARGET CLASSES</th>
                  <th style={{ padding: '12px' }}>DESIGNATED DAYS</th>
                  <th style={{ padding: '12px' }}>CONTACT EMAIL</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map((v) => (
                  <tr key={v.student_id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                    <td data-label="Student ID" style={{ padding: '12px' }}><b>{v.student_id}</b></td>
                    <td data-label="Name" style={{ padding: '12px' }}>{v.full_name}</td>
                    <td data-label="Role" style={{ padding: '12px' }}>
                      <span className="badge badge-info">Level {v.role_level || 1}</span>
                    </td>
                    <td data-label="Target" style={{ padding: '12px' }}><b>{v.target_classes || 20} Classes</b></td>
                    <td data-label="Days" style={{ padding: '12px' }}>{(v.designated_days || []).join(', ') || '—'}</td>
                    <td data-label="Email" style={{ padding: '12px', fontSize: '12px', color: 'var(--prodip-muted)' }}>{v.email || '—'}</td>
                    <td data-label="Actions" style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingMentor({
                            ...v,
                            target_classes: v.target_classes || 20,
                            designated_days: v.designated_days || []
                          });
                          setIsEditMentorModalOpen(true);
                        }}
                        className="btn-row"
                        style={{ background: 'var(--surface-hover)', border: '1px solid var(--prodip-border)', color: 'var(--prodip-navy)' }}
                      >
                        Edit Mentor
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  <input
                    type="text"
                    placeholder="e.g. CSE"
                    value={newVolunteer.department}
                    onChange={e => setNewVolunteer({ ...newVolunteer, department: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
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
                    <option value={5}>Level 5: Assistant Director</option>
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

      {/* ─── MODAL 3: EDIT MENTOR DETAILS ─── */}
      {isEditMentorModalOpen && editingMentor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--prodip-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} /> Edit Mentor: {editingMentor.full_name}
              </h3>
              <button onClick={() => setIsEditMentorModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Full Name</label>
                <input
                  type="text"
                  value={editingMentor.full_name}
                  onChange={e => setEditingMentor({ ...editingMentor, full_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  value={editingMentor.email || ''}
                  onChange={e => setEditingMentor({ ...editingMentor, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Role Level</label>
                  <select
                    value={editingMentor.role_level || 2}
                    onChange={e => setEditingMentor({ ...editingMentor, role_level: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  >
                    <option value={1}>Level 1: Trainee</option>
                    <option value={2}>Level 2: Active Volunteer</option>
                    <option value={3}>Level 3: Coordinator</option>
                    <option value={4}>Level 4: Senior Coordinator</option>
                    <option value={5}>Level 5: Assistant Director</option>
                    <option value={6}>Level 6: Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Target Classes</label>
                  <input
                    type="number"
                    value={editingMentor.target_classes || 20}
                    onChange={e => setEditingMentor({ ...editingMentor, target_classes: parseInt(e.target.value) || 20 })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Designated Teaching Days</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' }}>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                    const isChecked = (editingMentor.designated_days || []).includes(day);
                    return (
                      <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const cur = editingMentor.designated_days || [];
                            if (e.target.checked) {
                              setEditingMentor({ ...editingMentor, designated_days: [...cur, day] });
                            } else {
                              setEditingMentor({ ...editingMentor, designated_days: cur.filter(d => d !== day) });
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
                  onClick={() => setIsEditMentorModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--prodip-border)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditMentor}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--prodip-navy)', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </section>
    </AuthGate>
  );
}
