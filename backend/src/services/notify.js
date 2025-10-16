import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

let wss = null;
const clients = new Map(); // userId -> Set(ws)

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT,
      link VARCHAR(255),
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function initNotifications(server) {
  await ensureTable();
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) { ws.close(); return; }
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      ws.__user = { id: payload.id, role: payload.role };
      if (!clients.has(payload.id)) clients.set(payload.id, new Set());
      clients.get(payload.id).add(ws);
      ws.on('close', () => {
        const set = clients.get(payload.id);
        if (set) { set.delete(ws); if (set.size === 0) clients.delete(payload.id); }
      });
    } catch {
      try { ws.close(); } catch {}
    }
  });
}

function pushToUserIds(userIds, payload) {
  const data = JSON.stringify(payload);
  for (const uid of userIds) {
    const set = clients.get(Number(uid));
    if (!set) continue;
    for (const ws of set) {
      try { ws.send(data); } catch {}
    }
  }
}

export async function createNotifications(userIds, { title, body = '', link = null }) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const values = userIds.map(uid => [uid, title, body || null, link || null]);
  await pool.query(
    `INSERT INTO notifications (user_id, title, body, link) VALUES ?`,
    [values]
  );
  pushToUserIds(userIds, { type: 'notification', title, body, link, ts: Date.now() });
}

export async function notifyRoles(roles, payload) {
  const roleList = roles && roles.length ? roles : ['Admin','Warden'];
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE role IN (${roleList.map((_,i)=>`:r${i}`).join(',')}) AND is_active=1`,
    Object.fromEntries(roleList.map((r,i)=>[`r${i}`, r]))
  );
  const ids = rows.map(r => r.id);
  if (ids.length) await createNotifications(ids, payload);
}

export async function notifyUser(userId, payload) {
  await createNotifications([userId], payload);
}

