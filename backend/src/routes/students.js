import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Current student's own details
router.get('/me', requireAuth(['Student']), async (req, res) => {
  const userId = req.user.id;
  let [[stu]] = await pool.query(
    `SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
     FROM students s JOIN users u ON u.id=s.user_id
     WHERE s.user_id = :uid`, { uid: userId }
  );
  if (!stu) {
    const [[user]] = await pool.query('SELECT id, role, email, first_name, last_name, phone, nic_number, profile_photo FROM users WHERE id=:id', { id: userId });
    if (!user || user.role !== 'Student') return res.status(404).json({ message: 'Student user not found' });
    await pool.query('INSERT IGNORE INTO students (user_id) VALUES (:uid)', { uid: userId });
    [[stu]] = await pool.query(
      `SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
       FROM students s JOIN users u ON u.id=s.user_id
       WHERE s.user_id = :uid`, { uid: userId }
    ).then(r=>r[0]);
  }
  const [[alloc]] = await pool.query(
    `SELECT a.*, r.room_number, r.room_id,
            f.name AS floor, b.name AS block
     FROM allocations a
     JOIN rooms r ON r.room_id=a.room_id
     JOIN floors f ON f.floor_id=r.floor_id
     JOIN blocks b ON b.block_id=f.block_id
     WHERE a.student_id=:sid AND a.is_active=1
     ORDER BY a.start_date DESC
     LIMIT 1`, { sid: stu.student_id }
  );
  res.json({ student: stu, allocation: alloc || null });
});

router.get('/', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
    FROM students s JOIN users u ON u.id=s.user_id
    ORDER BY u.first_name, u.last_name
  `);
  res.json(rows);
});

router.put('/:student_id', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const { student_id } = req.params;
  const { guardian_name, guardian_phone, address, first_name, last_name, phone, nic_number } = req.body || {};

  // If the caller is a student, ensure they can only update their own record
  if (req.user.role === 'Student') {
    const [[me]] = await pool.query('SELECT student_id FROM students WHERE user_id=:uid', { uid: req.user.id });
    if (!me || String(me.student_id) !== String(student_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  // Fetch user id for updating users table
  const [[stu]] = await pool.query('SELECT user_id FROM students WHERE student_id=:id', { id: student_id });
  if (!stu) return res.status(404).json({ message: 'Student not found' });

  // Update students table (only provided fields)
  const sSets = [];
  const sParams = { id: student_id };
  if (Object.prototype.hasOwnProperty.call(req.body, 'guardian_name')) { sSets.push('guardian_name=:g'); sParams.g = guardian_name; }
  if (Object.prototype.hasOwnProperty.call(req.body, 'guardian_phone')) { sSets.push('guardian_phone=:p'); sParams.p = guardian_phone; }
  if (Object.prototype.hasOwnProperty.call(req.body, 'address')) { sSets.push('address=:a'); sParams.a = address; }
  if (sSets.length) {
    try {
      await pool.query(`UPDATE students SET ${sSets.join(', ')} WHERE student_id=:id`, sParams);
    } catch (e) {
      return res.status(500).json({ message: 'Failed to update student' });
    }
  }

  // Optionally update users table (first/last/phone/nic) only if provided
  const uSets = [];
  const uParams = { uid: stu.user_id };
  if (Object.prototype.hasOwnProperty.call(req.body, 'first_name')) { uSets.push('first_name=:fn'); uParams.fn = first_name; }
  if (Object.prototype.hasOwnProperty.call(req.body, 'last_name')) { uSets.push('last_name=:ln'); uParams.ln = last_name; }
  if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) { uSets.push('phone=:ph'); uParams.ph = phone; }
  if (Object.prototype.hasOwnProperty.call(req.body, 'nic_number')) { uSets.push('nic_number=:nic'); uParams.nic = nic_number; }
  if (uSets.length) {
    try {
      await pool.query(`UPDATE users SET ${uSets.join(', ')} WHERE id=:uid`, uParams);
    } catch (e) {
      return res.status(500).json({ message: 'Failed to update user' });
    }
  }

  res.json({ message: 'Updated' });
});

router.delete('/:student_id', requireAuth(['Admin','Warden']), async (req, res) => {
  const { student_id } = req.params;
  await pool.query('DELETE FROM students WHERE student_id=:id', { id: student_id });
  res.json({ message: 'Deleted' });
});

export default router;
