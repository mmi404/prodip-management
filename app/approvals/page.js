'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import QuickSwitcher from '@/components/QuickSwitcher';
import AuthGate from '@/components/AuthGate';
import { Shield, Check, X, Users, Search, Edit3, PlusCircle, UserPlus, Upload, Download, FileSpreadsheet } from 'lucide-react';

export default function ApprovalsPage() {
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
    target_classes: 36,
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
      const { data: vol } = await supabase.from('volunteers').select('*').eq('auth_user_id', session.user.id).single();
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

  const handleApprove = async (logId) => {
    const updated = allLogs.map(l => l.id === logId ? { ...l, status: 'Approved' } : l);
    setAllLogs(updated);
    await supabase.from('attendance_logs').update({ status: 'Approved' }).eq('id', logId);
    alert('✅ Session log approved and credited to volunteer streak!');
  };

  const handleReject = async (logId) => {
    const updated = allLogs.map(l => l.id === logId ? { ...l, status: 'Rejected' } : l);
    setAllLogs(updated);
    await supabase.from('attendance_logs').update({ status: 'Rejected' }).eq('id', logId);
    alert('❌ Session log rejected.');
  };

  // Manual Volunteer Add
  const handleManualAddVolunteer = async () => {
    if (!newVolunteer.student_id.trim() || !newVolunteer.full_name.trim()) {
      alert('Student ID and Full Name are required.');
      return;
    }

    const payload = {
      ...newVolunteer,
      student_id: newVolunteer.student_id.trim(),
      full_name: newVolunteer.full_name.trim(),
      email: newVolunteer.email.trim() || `${newVolunteer.student_id.trim()}@prodip.org`
    };

    const { error } = await supabase.from('volunteers').insert([payload]);
    if (error) {
      alert('Notice: ' + error.message + ' (Added to active session)');
    } else {
      alert(`✅ Volunteer ${payload.full_name} (${payload.student_id}) added successfully!`);
    }

    setVolunteers([payload, ...volunteers]);
    setIsAddVolunteerModalOpen(false);
    setNewVolunteer({
      student_id: '',
      full_name: '',
      email: '',
      department: 'CSE',
      batch: "'21",
      role_level: 2,
      target_classes: 36,
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
        alert('CSV file appears empty or has only a header row.');
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
        const target_classes = parseInt(row[6]) || 36;
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
      alert('Please select a valid CSV file with volunteer rows.');
      return;
    }
    setIsUploadingBatch(true);
    const { error } = await supabase.from('volunteers').upsert(csvPreview, { onConflict: 'student_id' });
    setIsUploadingBatch(false);

    if (error) {
      alert('Notice: ' + error.message + ' (Imported to current session)');
    } else {
      alert(`✅ Successfully imported ${csvPreview.length} volunteers into database!`);
    }

    setVolunteers(prev => {
      const map = new Map();
      prev.forEach(v => map.set(v.student_id, v));
      csvPreview.forEach(v => map.set(v.student_id, v));
      return Array.from(map.values());
    });

    setIsBatchUploadModalOpen(false);
    setCsvPreview([]);
    setCsvFileName('');
  };

  // Save Edited Mentor
  const handleSaveEditMentor = async () => {
    if (!editingMentor) return;
    const { error } = await supabase.from('volunteers').update({
      full_name: editingMentor.full_name,
      email: editingMentor.email,
      role_level: parseInt(editingMentor.role_level) || 2,
      target_classes: parseInt(editingMentor.target_classes) || 36,
      designated_days: editingMentor.designated_days
    }).eq('student_id', editingMentor.student_id);

    if (error) {
      alert('Notice: ' + error.message + ' (Updated in active session)');
    } else {
      alert(`✅ Volunteer ${editingMentor.full_name} updated successfully!`);
    }

    setVolunteers(volunteers.map(v => v.student_id === editingMentor.student_id ? editingMentor : v));
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
        <QuickSwitcher />

      {/* TOP HEADER & TAB BAR */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px 24px', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3e8ff', color: '#6b21a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={24} color="#6b21a8" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--prodip-navy)', margin: 0 }}>Attendance Approval Queue</h2>
              <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
                Senior Coordinator &amp; Admin verification queue for volunteer participation and streak accreditation.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            {['Pending', 'Approved', 'Rejected', 'All'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filterStatus === status ? '#fff' : 'transparent',
                  color: filterStatus === status ? 'var(--prodip-navy)' : 'var(--prodip-muted)',
                  boxShadow: filterStatus === status ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {status} {status === 'Pending' ? `(${pendingCount})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* SECONDARY NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--prodip-border)', paddingTop: '14px' }}>
          <button
            onClick={() => setActiveTab('queue')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'queue' ? 'var(--prodip-navy)' : '#f8fafc',
              color: activeTab === 'queue' ? 'white' : 'var(--prodip-navy)'
            }}
          >
            📋 Submissions Queue ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('mentors')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'mentors' ? 'var(--prodip-navy)' : '#f8fafc',
              color: activeTab === 'mentors' ? 'white' : 'var(--prodip-navy)'
            }}
          >
            👥 Manage Mentors &amp; Teacher Data
          </button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        /* APPROVAL QUEUE TABLE (Image 3) */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800 }}>Review Submissions ({filteredLogs.length})</h3>
            <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
              Approving a record officially credits the class to the mentor's milestone progress bar and streak.
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px', minWidth: '800px' }}>
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
                      <td style={{ padding: '14px 12px' }}>
                        <b>{log.session_date}</b>
                        <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)', display: 'block' }}>{log.day_of_week}</span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ background: '#f3e8ff', color: '#6b21a8', fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px' }}>
                          {log.activity_title}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <b>{log.instructor_name}</b>
                        <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)', display: 'block' }}>ID: {log.instructor_id}</span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        {log.replacement_name ? (
                          <span style={{ background: '#f3e8ff', color: '#6b21a8', fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                            🔀 Substituted by {log.replacement_name}
                          </span>
                        ) : (
                          <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            👤 Attended Directly
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <div style={{ fontSize: '12px', color: '#475569' }}>In: <b>{log.in_time}</b></div>
                        <div style={{ fontSize: '12px', color: '#475569' }}>Out: <b>{log.out_time || 'Ongoing'}</b></div>
                        <b style={{ fontSize: '13px', color: 'var(--prodip-navy)' }}>{log.hours || '2.0 Hours'}</b>
                      </td>
                      <td style={{ padding: '14px 12px', color: 'var(--prodip-muted)', fontSize: '12.5px' }}>
                        {log.topic_covered || 'No remarks'}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          background: log.status === 'Approved' ? '#dcfce7' : log.status === 'Rejected' ? '#fee2e2' : '#fef9c3',
                          color: log.status === 'Approved' ? '#166534' : log.status === 'Rejected' ? '#991b1b' : '#854d0e'
                        }}>
                          {log.status === 'Pending' ? '⌛ Pending' : log.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        {log.status === 'Pending' ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleApprove(log.id)}
                              style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleReject(log.id)}
                              style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)', fontStyle: 'italic' }}>Verified</span>
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
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mentor..."
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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px', minWidth: '700px' }}>
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
                    <td style={{ padding: '12px' }}><b>{v.student_id}</b></td>
                    <td style={{ padding: '12px' }}>{v.full_name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                        Level {v.role_level || 2}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}><b>{v.target_classes || 36} Classes</b></td>
                    <td style={{ padding: '12px' }}>{(v.designated_days || ['Sunday','Tuesday','Friday']).join(', ')}</td>
                    <td style={{ padding: '12px', fontSize: '12px', color: 'var(--prodip-muted)' }}>{v.email || '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingMentor({
                            ...v,
                            target_classes: v.target_classes || 36,
                            designated_days: v.designated_days || ['Sunday', 'Tuesday', 'Friday']
                          });
                          setIsEditMentorModalOpen(true);
                        }}
                        style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
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
                    <option value={6}>Level 6: System Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Target Classes</label>
                  <input
                    type="number"
                    value={newVolunteer.target_classes}
                    onChange={e => setNewVolunteer({ ...newVolunteer, target_classes: parseInt(e.target.value) || 36 })}
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
                    <option value={6}>Level 6: Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Target Classes</label>
                  <input
                    type="number"
                    value={editingMentor.target_classes || 36}
                    onChange={e => setEditingMentor({ ...editingMentor, target_classes: parseInt(e.target.value) || 36 })}
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
