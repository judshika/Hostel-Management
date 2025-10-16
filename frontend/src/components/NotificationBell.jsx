import React, { useMemo, useState } from 'react';
import { useNotifications } from '../context/NotificationsContext';
import { useNavigate } from 'react-router-dom';
import '../styles/notifications.css';

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications() || {};
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const top = useMemo(() => (items || []).slice(0, 10), [items]);

  const onItemClick = async (it) => {
    setOpen(false);
    if (!it.is_read && typeof it.notification_id === 'number') {
      await markRead([it.notification_id]);
    }
    if (it.link) navigate(it.link);
  };

  return (
    <div className="notif-wrap">
      <button className="btn btn-outline-secondary btn-sm notif-bell-btn" onClick={() => setOpen(o=>!o)} aria-haspopup>
        {/* Bell icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"/>
        </svg>
        {unread > 0 && (<span className="notif-badge">{unread}</span>)}
      </button>
      {open && (
        <div className="notif-dropdown card">
          <div className="card-body p-2">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <strong>Notifications</strong>
              <button className="btn btn-link btn-sm" onClick={() => markAllRead()}>Mark all read</button>
            </div>
            {top.length === 0 ? (
              <div className="text-muted small">No notifications</div>
            ) : (
              <ul className="list-unstyled mb-0 notif-list">
                {top.map((it) => (
                  <li key={it.notification_id} className={`notif-item ${it.is_read ? 'read' : 'unread'}`} onClick={() => onItemClick(it)}>
                    <div className="notif-title">{it.title}</div>
                    {it.body && <div className="notif-body">{it.body}</div>}
                    <div className="notif-time">{new Date(it.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
