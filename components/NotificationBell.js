'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications
} from '@/lib/notifications';

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function NotificationBell({ studentId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!studentId) return;
    fetchNotifications(studentId).then(setItems).catch(() => {});
    const unsubscribe = subscribeToNotifications(studentId, (row) => {
      setItems((prev) => [row, ...prev]);
    });
    return unsubscribe;
  }, [studentId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!studentId) return null;

  const unreadCount = items.filter((n) => !n.read_at).length;

  const openItem = async (n) => {
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAll = () => {
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    markAllNotificationsRead(studentId).catch(() => {});
  };

  return (
    <div className="notif-bell" ref={panelRef}>
      <button type="button" className="notif-bell-trigger" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-panel-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-mark-all" onClick={markAll}>Mark all read</button>
            )}
          </div>
          <div className="notif-panel-list">
            {items.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <button key={n.id} type="button" className={`notif-item ${n.read_at ? '' : 'unread'}`} onClick={() => openItem(n)}>
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-meta">{n.sender_name || 'PVMS'} · {timeAgo(n.created_at)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
