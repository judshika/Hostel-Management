import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// List my notifications (newest first)
router.get('/', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const [rows] = await pool.query(
    `SELECT notification_id, title, body, link, is_read, created_at
     FROM notifications WHERE user_id=:uid
     ORDER BY created_at DESC, notification_id DESC
     LIMIT ${limit}`,
    { uid: req.user.id }
  );
  // Compute unread count
  const [[c]] = await pool.query(
    `SELECT COUNT(*) AS c FROM notifications WHERE user_id=:uid AND is_read=0`,
    { uid: req.user.id }
  );
  res.json({ notifications: rows, unread: Number(c?.c || 0) });
});

// Mark selected notifications as read
router.post('/read', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.json({ updated: 0 });
  const placeholders = ids.map((_, i) => `:id${i}`).join(',');
  const params = Object.fromEntries(ids.map((v, i) => [`id${i}`, v]));
  await pool.query(
    `UPDATE notifications SET is_read=1 WHERE user_id=:uid AND notification_id IN (${placeholders})`,
    { uid: req.user.id, ...params }
  );
  res.json({ updated: ids.length });
});

// Mark all as read
router.post('/read-all', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const [r] = await pool.query(
    `UPDATE notifications SET is_read=1 WHERE user_id=:uid AND is_read=0`,
    { uid: req.user.id }
  );
  res.json({ updated: r?.affectedRows || 0 });
});

export default router;

