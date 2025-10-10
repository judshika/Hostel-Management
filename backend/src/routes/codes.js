import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ROLES = new Set(['Admin', 'Warden', 'Student']);

function randomCode(prefix) {
  const base = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${base}`;
}

// List active (working) registration codes
router.get('/', requireAuth(['Admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT code_id, role, code, created_at FROM registration_codes WHERE is_active = 1 ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch codes' });
  }
});

// Generate a new role-based registration code
router.post('/', requireAuth(['Admin']), async (req, res) => {
  const { role } = req.body || {};
  if (!role || !ROLES.has(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  const prefix = role.toUpperCase();

  // Attempt to generate a unique code a few times
  for (let i = 0; i < 5; i++) {
    const code = randomCode(prefix);
    try {
      const [r] = await pool.query(
        'INSERT INTO registration_codes (role, code, is_active) VALUES (:role, :code, 1)',
        { role, code }
      );
      const [rows] = await pool.query(
        'SELECT code_id, role, code, created_at FROM registration_codes WHERE code_id = :id',
        { id: r.insertId }
      );
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') continue; // retry on collision
      return res.status(500).json({ message: 'Failed to create code' });
    }
  }
  res.status(500).json({ message: 'Could not generate unique code' });
});

// Delete a registration code by id (only active list is exposed)
router.delete('/:id', requireAuth(['Admin']), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM registration_codes WHERE code_id = :id', { id });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete code' });
  }
});

export default router;

