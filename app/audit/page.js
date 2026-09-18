'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import QuickSwitcher from '@/components/QuickSwitcher';
import AuthGate from '@/components/AuthGate';
import { Award, Download, Printer, CheckCircle, Search, FileText } from 'lucide-react';

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
    return 'Sunday, Tuesday, Friday';
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

      let approved = matchingLogs.length;
      let totalVerifiedHours = matchingLogs.reduce((sum, l) => {
        const h = parseFloat(l.hours);
        return sum + (isNaN(h) ? 2.0 : h);
      }, 0);



      const target = v.target_classes || 36;
      const pct = target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 0;
      const left = Math.max(0, target - approved);
      const schedule = formatSchedule(v);
      const hoursStr = `${totalVerifiedHours.toFixed(1)} Hours`;

      return {
        ...v,
        approved_classes: approved,
        target_classes: target,
        total_hours: hoursStr,
        completion_pct: pct,
        classes_left: left,
        designated_display: schedule
      };
    });

    setVolunteers(computedVolunteers);
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student ID,Volunteer Name,Email,Approved Classes,Target Classes,Verified Hours,Designated Schedule\n";
    volunteers.forEach(v => {
      const target = v.target_classes || 36;
      csvContent += `${v.student_id},${v.full_name},${v.email || ''},${v.approved_classes || 0},${target},${v.total_hours || '0.0 Hours'},"${v.designated_display || formatSchedule(v)}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Prodip_Milestone_Audit_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        const target = v.target_classes || 36;
        const pct = v.completion_pct !== undefined ? v.completion_pct : (target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 0);
        const left = v.classes_left !== undefined ? v.classes_left : Math.max(0, target - approved);
        const hours = v.total_hours || `${(approved * 2.0).toFixed(1)} Hours`;
        const designated = v.designated_display || formatSchedule(v);
        return `
          <tr>
            <td style="font-weight: 700; color: #1e2c4f;">${v.student_id || '—'}</td>
            <td>
              <div style="font-weight: 700; color: #0f172a; font-size: 10px;">${v.full_name}</div>
              <div style="color: #64748b; font-size: 8.5px;">${v.email || `${v.student_id}@prodip.org`}</div>
            </td>
            <td style="color: #475569;">${v.role || 'Mentor'}</td>
            <td>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                <span style="font-weight: 700; color: #0f172a;">${approved}</span>
                <span style="color: #64748b; font-size: 8.5px;">/ ${target}</span>
              </div>
              <div style="background: #e2e8f0; height: 5px; width: 100%; border-radius: 3px; overflow: hidden;">
                <div style="background: #059669; width: ${pct}%; height: 100%;"></div>
              </div>
            </td>
            <td style="font-weight: 700; color: #0f172a;">${hours}</td>
            <td>
              <span style="display: inline-block; padding: 2px 6px; border-radius: 10px; font-size: 8.5px; font-weight: 700; background: ${left === 0 ? '#dcfce7' : '#f1f5f9'}; color: ${left === 0 ? '#166534' : '#475569'};">
                ${left === 0 ? 'Eligible ✓' : `${left} classes left`}
              </span>
            </td>
            <td style="color: #475569; font-size: 9.5px;">${designated}</td>
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
              <th>TOTAL VERIFIED HOURS</th>
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
      reportTitle = '📊 PRODIP — Approved Master Attendance Register';
      reportSubtitle = 'Complete historical database register of all verified checked-in sessions · CUET';
      recordCount = attendanceLogs.length;

      const rows = attendanceLogs.length > 0 ? attendanceLogs.map((log) => `
        <tr>
          <td style="font-weight: 700;">${log.session_date}</td>
          <td>${log.day_of_week}</td>
          <td>${log.instructor_id}</td>
          <td><strong>${log.instructor_name}</strong></td>
          <td>${log.activity_title}</td>
          <td>${log.in_time}</td>
          <td>${log.out_time || '--'}</td>
          <td>${log.topic_covered || 'N/A'}</td>
          <td>${log.status}</td>
        </tr>
      `).join('') : `
        <tr><td colspan="9" style="text-align: center; padding: 15px;">No attendance records found.</td></tr>
      `;

      tableHtml = `
        <table>
          <colgroup>
            <col style="width: 10%;" />
            <col style="width: 8%;" />
            <col style="width: 11%;" />
            <col style="width: 18%;" />
            <col style="width: 15%;" />
            <col style="width: 9%;" />
            <col style="width: 9%;" />
            <col style="width: 12%;" />
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
              <th>TOPIC COVERED</th>
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
        <title>${reportTitle} - ${printDate}</title>
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

  const filteredVolunteers = volunteers.filter(v =>
    v.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AuthGate minRoleLevel={3} requiredRoleName="Coordinator">
      <section>
        <QuickSwitcher />

      {/* PAGE HEADER WITH CSV & PRINT BUTTONS (Image 4) */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={26} color="#d97706" />
            </div>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--prodip-navy)', margin: 0 }}>
                Volunteer Milestone &amp; Certificate Audit Report
              </h2>
              <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>
                Official data table of volunteers who took classes, total hours verified, and certification eligibility for manual certificate issuance.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleExportCSV}
              style={{ background: 'var(--prodip-navy)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Download size={15} /> Export to CSV
            </button>
            <button
              onClick={handlePrint}
              style={{ background: '#f1f5f9', border: '1px solid var(--prodip-border)', color: 'var(--prodip-navy)', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Printer size={15} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* THREE REQUIREMENT SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--prodip-muted)', letterSpacing: '0.5px' }}>REQUIREMENT</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--prodip-navy)', margin: '6px 0 4px' }}>
            Milestone Classes
          </div>
          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>Configurable per volunteer target (e.g. 20–36 classes)</span>
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
          <span style={{ fontSize: '12px', color: 'var(--prodip-muted)' }}>1-click notification sent to volunteer email upon milestone</span>
        </div>
      </div>

      {/* TAB NAVIGATION: AUDIT VS EXCEL ALL ENTRIES */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13.5px',
            fontWeight: 800,
            cursor: 'pointer',
            background: activeTab === 'audit' ? 'var(--prodip-navy)' : '#fff',
            color: activeTab === 'audit' ? 'white' : 'var(--prodip-navy)',
            border: '1px solid var(--prodip-border)'
          }}
        >
          🏅 Volunteer Class &amp; Hours Audit
        </button>
        <button
          onClick={() => setActiveTab('all-entries')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13.5px',
            fontWeight: 800,
            cursor: 'pointer',
            background: activeTab === 'all-entries' ? 'var(--prodip-navy)' : '#fff',
            color: activeTab === 'all-entries' ? 'white' : 'var(--prodip-navy)',
            border: '1px solid var(--prodip-border)'
          }}
        >
          📊 All Entries Master Register (Excel View)
        </button>
      </div>

      {activeTab === 'audit' ? (
        /* VOLUNTEER CLASS & HOURS AUDIT TABLE */
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--prodip-navy)', fontWeight: 800 }}>
              Volunteer Class &amp; Hours Audit
            </h3>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11.5px', fontWeight: 700, padding: '4px 12px', borderRadius: '16px' }}>
              Sorted by Completion Progress
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px', minWidth: '850px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--prodip-border)', color: '#64748b' }}>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>STUDENT ID</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>VOLUNTEER NAME</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>ROLE</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>APPROVED / TARGET</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>TOTAL VERIFIED HOURS</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>CERTIFICATION STATUS</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>DESIGNATED SCHEDULE</th>
                  <th style={{ padding: '12px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>COMPLETION ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map((v) => {
                  const approved = v.approved_classes || 0;
                  const target = v.target_classes || 36;
                  const pct = v.completion_pct !== undefined ? v.completion_pct : (target > 0 ? Math.min(100, Math.round((approved / target) * 100)) : 0);
                  const left = v.classes_left !== undefined ? v.classes_left : Math.max(0, target - approved);
                  const schedule = v.designated_display || formatSchedule(v);

                  return (
                    <tr key={v.student_id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td style={{ padding: '14px 12px' }}>
                        <b>{v.student_id}</b>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <b style={{ color: 'var(--prodip-navy)', display: 'block' }}>{v.full_name}</b>
                        <span style={{ fontSize: '11.5px', color: 'var(--prodip-muted)' }}>{v.email || `${v.student_id}@prodip.org`}</span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ color: 'var(--prodip-muted)' }}>{v.role || 'Mentor'}</span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b>{approved}</b> <span style={{ color: 'var(--prodip-muted)', fontSize: '12px' }}>/ {target}</span>
                        </div>
                        <div style={{ background: '#e2e8f0', height: '6px', width: '90px', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                          <div style={{ background: '#059669', width: `${pct}%`, height: '100%' }}></div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <b>{v.total_hours || `${(approved * 2.0).toFixed(1)} Hours`}</b>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px' }}>
                          {left === 0 ? 'Eligible' : `${left} classes left`}
                        </span>
                      </td>
                      <td style={{ padding: '14px 12px', fontSize: '12.5px' }}>
                        {schedule}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                        <a href="/profile" style={{ color: 'var(--prodip-navy)', fontWeight: 700, textDecoration: 'none', fontSize: '13px' }}>
                          View Streak &gt;
                        </a>
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
                Approved Master Attendance Register (Excel Table View)
              </h3>
              <span style={{ fontSize: '12.5px', color: 'var(--prodip-muted)' }}>Complete historical database register of all checked in sessions.</span>
            </div>
            <div style={{ position: 'relative', width: '280px' }}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '850px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--prodip-border)', color: '#475569' }}>
                  <th style={{ padding: '10px 12px' }}>DATE</th>
                  <th style={{ padding: '10px 12px' }}>DAY</th>
                  <th style={{ padding: '10px 12px' }}>VOLUNTEER ID</th>
                  <th style={{ padding: '10px 12px' }}>VOLUNTEER NAME</th>
                  <th style={{ padding: '10px 12px' }}>ACTIVITY</th>
                  <th style={{ padding: '10px 12px' }}>IN-TIME</th>
                  <th style={{ padding: '10px 12px' }}>OUT-TIME</th>
                  <th style={{ padding: '10px 12px' }}>TOPIC COVERED</th>
                  <th style={{ padding: '10px 12px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {attendanceLogs.length > 0 ? (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--prodip-border)' }}>
                      <td style={{ padding: '10px 12px' }}><b>{log.session_date}</b></td>
                      <td style={{ padding: '10px 12px' }}>{log.day_of_week}</td>
                      <td style={{ padding: '10px 12px' }}>{log.instructor_id}</td>
                      <td style={{ padding: '10px 12px' }}><b>{log.instructor_name}</b></td>
                      <td style={{ padding: '10px 12px' }}>{log.activity_title}</td>
                      <td style={{ padding: '10px 12px' }}>{log.in_time}</td>
                      <td style={{ padding: '10px 12px' }}>{log.out_time || '--'}</td>
                      <td style={{ padding: '10px 12px' }}>{log.topic_covered || 'N/A'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: log.status === 'Approved' ? '#dcfce7' : '#fef9c3',
                          color: log.status === 'Approved' ? '#166534' : '#854d0e'
                        }}>
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
