'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AuthGate from '@/components/AuthGate';
import { escapeHtml as esc } from '@/lib/escapeHtml';
import { formatClock, logDuration, sumMinutes, formatMinutes, minutesToDecimalHours } from '@/lib/time';
import { Award, Download, Printer, CheckCircle, Search, FileText } from 'lucide-react';

const ROLE_NAMES = { 1: 'Trainee', 2: 'Volunteer', 3: 'Coordinator', 4: 'Sr. Coordinator', 5: 'Asst. Director', 6: 'Admin' };
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'all-entries'
  const [volunteers, setVolunteers] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAuditData();
  }, []);

  const formatSchedule = (v) => {
    if (Array.isArray(v.designated_days) && v.designated_days.length > 0) {
      return v.designated_days.join(', ');
    }
    if (typeof v.designated_days === 'string' && v.designated_days.trim()) {
      return v.designated_days;
    }
    if (v.designated && typeof v.designated === 'string' && v.designated.trim()) {
      return v.designated;
    }
    return '—';
  };

  const fetchAuditData = async () => {
    const { data: vols } = await supabase.from('volunteers').select('*').order('full_name');
    const { data: logs } = await supabase.from('attendance_logs').select('*').order('session_date', { ascending: false });

    if (logs) setAttendanceLogs(logs);

    let rawVols = vols || [];

    // Dynamic calculation: join volunteers with attendance_logs
    const computedVolunteers = rawVols.map((v) => {
      // Find all approved attendance logs credited to this volunteer
      const matchingLogs = (logs || []).filter((l) => {
        const isCredited = l.credited_to_id === v.student_id || (!l.credited_to_id && l.instructor_id === v.student_id);
        const isApproved = l.status === 'Approved';
        return isCredited && isApproved;
      });

      const approved = matchingLogs.length;
      const totalMins = sumMinutes(matchingLogs);

      const target = v.target_classes || 20;
      const pct = target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 0;
      const left = Math.max(0, target - approved);
      const schedule = formatSchedule(v);
      const hoursStr = formatMinutes(totalMins);

      return {
        ...v,
        approved_classes: approved,
        target_classes: target,
        total_hours: hoursStr,
        total_minutes: totalMins,
        completion_pct: pct,
        classes_left: left,
        designated_display: schedule
      };
    });

    setVolunteers(computedVolunteers);
  };

  const handleExportCSV = () => {
    const rows = [['Student ID', 'Volunteer Name', 'Email', 'Approved Classes', 'Target Classes', 'Verified Hours (decimal)', 'Verified Time', 'Designated Schedule']];
    volunteers.forEach((v) => {
      rows.push([
        v.student_id,
        v.full_name,
        v.email || '',
        v.approved_classes || 0,
        v.target_classes || 20,
        minutesToDecimalHours(v.total_minutes || 0),
        v.total_hours || '0 min',
        v.designated_display || formatSchedule(v)
      ]);
    });
    // Blob (not a data: URI) so names containing # or , can't corrupt the file; BOM keeps Excel happy with Bangla names.
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prodip_Milestone_Audit_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const existingFrame = document.getElementById('prodip-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'prodip-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    let tableHtml = '';
    let reportTitle = '';
    let reportSubtitle = '';
    let recordCount = 0;

    if (activeTab === 'audit') {
      reportTitle = '🏅 PRODIP — Milestone & Certificate Audit Report';
      reportSubtitle = 'Official volunteer verified hours and certification eligibility register · CUET';
      recordCount = filteredVolunteers.length;

      const rows = filteredVolunteers.map((v) => {
        const approved = v.approved_classes || 0;
        const target = v.target_classes || 20;
        const pct = v.completion_pct !== undefined ? v.completion_pct : (target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 0);
        const left = v.classes_left !== undefined ? v.classes_left : Math.max(0, target - approved);
        const hours = v.total_hours || '0 min';
        const designated = v.designated_display || formatSchedule(v);
        return `
          <tr>
            <td style="font-weight: 700; color: #1e2c4f;">${esc(v.student_id) || '—'}</td>
            <td>
              <div style="font-weight: 700; color: #0f172a; font-size: 10px;">${esc(v.full_name)}</div>
              <div style="color: #64748b; font-size: 8.5px;">${esc(v.email || '')}</div>
            </td>
            <td style="color: #475569;">${esc(ROLE_NAMES[v.role_level] || 'Volunteer')}</td>
            <td>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                <span style="font-weight: 700; color: #0f172a;">${approved}</span>
                <span style="color: #64748b; font-size: 8.5px;">/ ${target}</span>
              </div>
              <div style="background: #e2e8f0; height: 5px; width: 100%; border-radius: 3px; overflow: hidden;">
                <div style="background: #059669; width: ${pct}%; height: 100%;"></div>
              </div>
            </td>
            <td style="font-weight: 700; color: #0f172a;">${esc(hours)}</td>
            <td>
              <span style="display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 8.5px; font-weight: 700; background: ${left === 0 ? '#dcfce7' : '#f1f5f9'}; color: ${left === 0 ? '#166534' : '#475569'};">
                ${left === 0 ? 'Eligible ✓' : `${left} classes left`}
              </span>
            </td>
            <td style="color: #475569; font-size: 9.5px;">${esc(designated)}</td>
          </tr>
        `;
      }).join('');

      tableHtml = `
        <table>
          <colgroup>
            <col style="width: 12%;" />
            <col style="width: 26%;" />
            <col style="width: 10%;" />
            <col style="width: 14%;" />
            <col style="width: 13%;" />
            <col style="width: 12%;" />
            <col style="width: 13%;" />
          </colgroup>
          <thead>
            <tr>
              <th>STUDENT ID</th>
              <th>VOLUNTEER NAME</th>
              <th>ROLE</th>
              <th>APPROVED / TARGET</th>
              <th>VERIFIED TIME</th>
              <th>CERTIFICATION STATUS</th>
              <th>DESIGNATED SCHEDULE</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } else {
      reportTitle = '📊 PRODIP — Master Attendance Register';
      reportSubtitle = 'Complete historical database register of all verified checked-in sessions · CUET';
      recordCount = filteredLogs.length;

      const rows = filteredLogs.length > 0 ? filteredLogs.map((log) => `
        <tr>
          <td style="font-weight: 700;">${esc(log.session_date)}</td>
          <td>${esc(log.day_of_week)}</td>
          <td>${esc(log.credited_to_id || log.instructor_id)}</td>
          <td><strong>${esc(log.replacement_name || log.instructor_name)}</strong></td>
          <td>${esc(log.activity_title)}</td>
          <td>${esc(formatClock(log.in_time))}</td>
          <td>${log.out_time ? esc(formatClock(log.out_time)) : '--'}</td>
          <td>${esc(logDuration(log))}</td>
          <td>${esc(log.status)}</td>
        </tr>
      `).join('') : `
        <tr><td colspan="9" style="text-align: center; padding: 15px;">No attendance records found.</td></tr>
      `;

      tableHtml = `
        <table>
          <colgroup>
            <col style="width: 10%;" />
            <col style="width: 9%;" />
            <col style="width: 11%;" />
            <col style="width: 19%;" />
            <col style="width: 15%;" />
            <col style="width: 10%;" />
            <col style="width: 10%;" />
            <col style="width: 8%;" />
            <col style="width: 8%;" />
          </colgroup>
          <thead>
            <tr>
              <th>DATE</th>
              <th>DAY</th>
              <th>VOLUNTEER ID</th>
              <th>VOLUNTEER NAME</th>
              <th>ACTIVITY</th>
              <th>IN-TIME</th>
              <th>OUT-TIME</th>
              <th>DURATION</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${esc(reportTitle)} - ${esc(printDate)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 15mm 18mm 15mm 18mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 10px;
            line-height: 1.4;
            padding: 10mm 14mm;
          }
          .header-banner {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 12px;
            margin-bottom: 14px;
            border-bottom: 2.5px solid #1e2c4f;
          }
          .brand-title {
            font-size: 16px;
            font-weight: 800;
            color: #1e2c4f;
          }
          .brand-subtitle {
            font-size: 9.5px;
            color: #64748b;
            margin-top: 3px;
          }
          .meta-box {
            text-align: right;
            font-size: 9px;
            color: #64748b;
            line-height: 1.45;
          }
          .meta-box strong {
            color: #1e2c4f;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          thead tr {
            background-color: #1e2c4f !important;
            color: #ffffff !important;
          }
          th {
            background-color: #1e2c4f !important;
            color: #ffffff !important;
            padding: 9px 12px;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            text-align: left;
            border: 1px solid #1e2c4f;
            vertical-align: middle;
          }
          td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            border-left: 1px solid #f1f5f9;
            border-right: 1px solid #f1f5f9;
            font-size: 9.5px;
            vertical-align: middle;
            word-wrap: break-word;
          }
          tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          tbody tr:nth-child(even) td {
            background-color: #f8fafc !important;
          }
          .footer {
            margin-top: 16px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div>
            <div class="brand-title">${reportTitle}</div>
            <div class="brand-subtitle">${reportSubtitle}</div>
          </div>
          <div class="meta-box">
            <div><strong>Printed:</strong> ${printDate}</div>
            <div><strong>Total Entries:</strong> ${recordCount} records</div>
            <div><strong>Format:</strong> A4 Landscape Official Export</div>
          </div>
        </div>

        ${tableHtml}

        <div class="footer">
          <div>PRODIP Volunteer Management System (PVMS) · CUET · Official Internal Audit</div>
          <div>Page 1 of 1</div>
        </div>
      </body>
      </html>
    `;

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2000);
    }, 250);
  };

  const q = searchQuery.toLowerCase();
  const filteredVolunteers = volunteers.filter(v =>
    v.full_name.toLowerCase().includes(q) ||
    v.student_id.toLowerCase().includes(q)
  );
  const filteredLogs = attendanceLogs.filter(l =>
    !q ||
    (l.instructor_name || '').toLowerCase().includes(q) ||
    (l.replacement_name || '').toLowerCase().includes(q) ||
    (l.instructor_id || '').toLowerCase().includes(q) ||
    (l.credited_to_id || '').toLowerCase().includes(q) ||
    (l.session_date || '').includes(q) ||
    (l.activity_title || '').toLowerCase().includes(q)
  );

  return (
    <AuthGate minRoleLevel={3} requiredRoleName="Coordinator">
      <section>

      <div className="page-head" style={{ marginBottom: '24px' }}>
        <div className="page-head-main">
          <div className="page-head-icon" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-fg)' }}>
            <Award size={21} />
          </div>
          <div>
            <h2 className="page-head-title">Volunteer Milestone &amp; Certificate Audit</h2>
            <p className="page-head-subtitle">Verified hours and certification eligibility, for manual certificate issuance.</p>
          </div>
        </div>

        <div className="page-head-actions">
          <button onClick={handleExportCSV} className="btn-row" style={{ background: 'var(--prodip-navy)', color: 'white', minHeight: '42px' }}>
            <Download size={15} /> Export CSV
          </button>
          <button onClick={handlePrint} className="btn-row" style={{ background: 'var(--prodip-card)', border: '1px solid var(--prodip-border)', color: 'var(--prodip-navy)', minHeight: '42px' }}>
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* THREE REQUIREMENT SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>REQUIREMENT</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--prodip-navy)', margin: '6px 0 4px' }}>
            Milestone Classes
          </div>
          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>Configurable per volunteer (default 20 approved classes)</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>CERTIFICATE ISSUANCE</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', margin: '6px 0 4px' }}>
            Manual Generation
          </div>
          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>Use the verified hours &amp; dates data below</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>AUTOMATED EMAIL DISPATCH</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', margin: '6px 0 4px' }}>
            Ready On Target Completion
          </div>
          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>Not built yet — planned</span>
        </div>
      </div>

      {/* TAB NAVIGATION: AUDIT VS EXCEL ALL ENTRIES */}
      <div className="segmented" style={{ marginBottom: '16px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('audit')} className={`segmented-btn ${activeTab === 'audit' ? 'active dark' : ''}`}>
          🏅 Class &amp; Hours Audit
        </button>
        <button onClick={() => setActiveTab('all-entries')} className={`segmented-btn ${activeTab === 'all-entries' ? 'active dark' : ''}`}>
          📊 All Entries Register
        </button>
      </div>

      {activeTab === 'audit' ? (
        /* VOLUNTEER CLASS & HOURS AUDIT TABLE */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800 }}>
              Volunteer Class &amp; Hours Audit
            </h3>
            <span className="badge badge-neutral">{filteredVolunteers.length} volunteers</span>
          </div>
          <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '16px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search volunteers..."
              style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1px solid var(--prodip-border)', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--prodip-border)', color: '#64748b' }}>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>STUDENT ID</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>VOLUNTEER NAME</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ROLE</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>APPROVED / TARGET</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>TOTAL VERIFIED HOURS</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>CERTIFICATION STATUS</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>DESIGNATED SCHEDULE</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map((v) => {
                  const approved = v.approved_classes || 0;
                  const target = v.target_classes || 20;
                  const pct = v.completion_pct !== undefined ? v.completion_pct : (target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 0);
                  const left = v.classes_left !== undefined ? v.classes_left : Math.max(0, target - approved);
                  const schedule = v.designated_display || formatSchedule(v);

                  return (
                    <tr key={v.student_id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td data-label="Student ID" style={{ padding: '14px 12px' }}>
                        <b>{v.student_id}</b>
                      </td>
                      <td data-label="Volunteer" style={{ padding: '14px 12px' }}>
                        <b style={{ color: 'var(--prodip-navy)', display: 'block' }}>{v.full_name}</b>
                        <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)' }}>{v.email || '—'}</span>
                      </td>
                      <td data-label="Role" style={{ padding: '14px 12px' }}>
                        <span style={{ color: 'var(--prodip-muted)' }}>{ROLE_NAMES[v.role_level] || 'Volunteer'}</span>
                      </td>
                      <td data-label="Approved / Target" style={{ padding: '14px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b>{approved}</b> <span style={{ color: 'var(--prodip-muted)', fontSize: '12px' }}>/ {target}</span>
                        </div>
                        <div style={{ background: '#e2e8f0', height: '6px', width: '90px', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                          <div style={{ background: '#059669', width: `${pct}%`, height: '100%' }}></div>
                        </div>
                      </td>
                      <td data-label="Verified Time" style={{ padding: '14px 12px' }}>
                        <b>{v.total_hours || '0 min'}</b>
                      </td>
                      <td data-label="Certificate" style={{ padding: '14px 12px' }}>
                        <span className={`badge ${left === 0 ? 'badge-success' : 'badge-neutral'}`}>
                          {left === 0 ? 'Eligible' : `${left} classes left`}
                        </span>
                      </td>
                      <td data-label="Schedule" style={{ padding: '14px 12px', fontSize: '12.5px' }}>
                        {schedule}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MASTER EXCEL ALL ENTRIES TABLE */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800 }}>
                Master Attendance Register (all statuses)
              </h3>
              <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Complete historical database register of all checked in sessions.</span>
            </div>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid var(--prodip-border)', borderRadius: '6px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="rtable" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>DATE</th>
                  <th style={{ padding: '10px 12px' }}>DAY</th>
                  <th style={{ padding: '10px 12px' }}>VOLUNTEER ID</th>
                  <th style={{ padding: '10px 12px' }}>VOLUNTEER NAME</th>
                  <th style={{ padding: '10px 12px' }}>ACTIVITY</th>
                  <th style={{ padding: '10px 12px' }}>IN-TIME</th>
                  <th style={{ padding: '10px 12px' }}>OUT-TIME</th>
                  <th style={{ padding: '10px 12px' }}>DURATION</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td data-label="Date" style={{ padding: '10px 12px' }}><b>{log.session_date}</b></td>
                      <td data-label="Day" style={{ padding: '10px 12px' }}>{log.day_of_week}</td>
                      <td data-label="Volunteer ID" style={{ padding: '10px 12px' }}>{log.credited_to_id || log.instructor_id}</td>
                      <td data-label="Volunteer" style={{ padding: '10px 12px' }}>
                        <b>{log.replacement_name || log.instructor_name}</b>
                        {log.replacement_name && <div style={{ fontSize: '11px', color: 'var(--prodip-muted)' }}>for {log.instructor_name}</div>}
                      </td>
                      <td data-label="Activity" style={{ padding: '10px 12px' }}>{log.activity_title}</td>
                      <td data-label="In" style={{ padding: '10px 12px' }}>{formatClock(log.in_time)}</td>
                      <td data-label="Out" style={{ padding: '10px 12px' }}>{log.out_time ? formatClock(log.out_time) : '--'}</td>
                      <td data-label="Duration" style={{ padding: '10px 12px' }}>{logDuration(log)}</td>
                      <td data-label="Status" style={{ padding: '10px 12px' }}>
                        <span className={`badge ${log.status === 'Approved' ? 'badge-success' : log.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--prodip-muted)' }}>
                      No attendance entries registered in database yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </section>
    </AuthGate>
  );
}
