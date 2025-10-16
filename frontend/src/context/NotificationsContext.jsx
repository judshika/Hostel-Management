import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API } from '../api';
import { useAuth } from './AuthContext';

const Ctx = createContext(null);

export function NotificationsProvider({ children }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]); // {notification_id,title,body,link,is_read,created_at}
  const [unread, setUnread] = useState(0);
  const wsRef = useRef(null);

  const API_ORIGIN = useMemo(() => {
    const base = (import.meta.env.VITE_API_URL || '/api');
    // If absolute, drop "/api" suffix to get origin
    if (/^https?:\/\//.test(base)) return base.replace(/\/?api$/, '');
    // Assume same-origin
    return window.location.origin;
  }, []);

  async function load() {
    try {
      const { data } = await API.get('/notifications?limit=50');
      setItems(data.notifications || []);
      setUnread(Number(data.unread || 0));
    } catch {
      setItems([]); setUnread(0);
    }
  }

  function connect() {
    if (!token || !user) return;
    try { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } } catch {}
    const proto = API_ORIGIN.startsWith('https') ? 'wss' : 'ws';
    const url = `${proto}://${API_ORIGIN.replace(/^https?:\/\//,'')}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg && msg.type === 'notification') {
          // Prepend optimistic item (no id yet), refresh list to sync ids and counts
          setItems(prev => [{
            notification_id: `tmp-${Date.now()}`,
            title: msg.title,
            body: msg.body || '',
            link: msg.link || null,
            is_read: 0,
            created_at: new Date().toISOString(),
          }, ...prev].slice(0, 50));
          setUnread(u => u + 1);
        }
      } catch {}
    };
    ws.onopen = () => { /* no-op */ };
    ws.onclose = () => { /* try later */ };
    ws.onerror = () => { /* ignore */ };
    wsRef.current = ws;
  }

  async function markRead(ids) {
    if (!ids || ids.length === 0) return;
    await API.post('/notifications/read', { ids });
    setItems(prev => prev.map(it => ids.includes(it.notification_id) ? { ...it, is_read: 1 } : it));
    setUnread(u => Math.max(0, u - ids.length));
  }

  async function markAllRead() {
    await API.post('/notifications/read-all');
    setItems(prev => prev.map(it => ({ ...it, is_read: 1 })));
    setUnread(0);
  }

  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => { if (user && token) connect(); }, [user, token]);

  const value = useMemo(() => ({ items, unread, reload: load, markRead, markAllRead }), [items, unread]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() { return useContext(Ctx); }

