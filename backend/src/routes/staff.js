import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth(['Admin']), async (req, res) => {
  const { name, role, phone, shift } = req.body;
  const [r] = await pool.query('INSERT INTO staff (name, role, phone, shift) VALUES (:n,:r,:p,:s)',
    { n: name, r: role, p: phone || null, s: shift || null });
  res.json({ staff_id: r.insertId });
});

router.get('/', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM staff ORDER BY name');
  res.json(rows);
});

router.put('/:id', requireAuth(['Admin']), async (req, res) => {
  const { id } = req.params;
  const { name, role, phone, shift } = req.body;
  await pool.query('UPDATE staff SET name=:n, role=:r, phone=:p, shift=:s WHERE staff_id=:id',
    { n: name, r: role, p: phone || null, s: shift || null, id });
  res.json({ message: 'Updated' });
});

router.delete('/:id', requireAuth(['Admin']), async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM staff WHERE staff_id=:id', { id });
  res.json({ message: 'Deleted' });
});

export default router;
