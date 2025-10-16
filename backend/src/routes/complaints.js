import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendEmail, templates } from '../routes/email.js';

const router = express.Router();

router.post('/', requireAuth(['Student']), async (req, res) => {
  const { title, description, photo_url } = req.body;
  // resolve student_id from token
  let [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id=:uid', { uid: req.user.id });
  if (!stu) {
    await pool.query('INSERT IGNORE INTO students (user_id) VALUES (:uid)', { uid: req.user.id });
    [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id=:uid', { uid: req.user.id }).then(r=>r[0]);
  }
  if (!stu) return res.status(400).json({ message: 'Student profile missing' });
  const [r] = await pool.query(
    'INSERT INTO complaints (student_id, title, description, photo_url) VALUES (:sid,:t,:d,:p)',
    { sid: stu.student_id, t: title, d: description || null, p: photo_url || null }
  );

  // Fire-and-forget notification to Admins and Wardens via email
  (async () => {
    try {
      // fetch student user details
      const [[u]] = await pool.query(
        'SELECT first_name, last_name, email FROM users WHERE id=:id',
        { id: req.user.id }
      );
      const studentName = `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || 'Student';
      const studentEmail = u?.email || '';
      const createdAt = new Date().toISOString();
      const mail = templates.complaintNew({ title, studentName, studentEmail, createdAt });

      const [admins] = await pool.query(
        "SELECT email FROM users WHERE role IN ('Admin','Warden') AND is_active=1 AND email IS NOT NULL"
      );
      const list = (admins || []).map(r => r.email).filter(Boolean);
      if (list.length > 0) {
        await sendEmail({ to: list.join(','), ...mail });
      }
    } catch (err) {
      console.error('Failed to send complaint notification email:', err.message);
    }
  })();

  res.json({ complaint_id: r.insertId });
});

router.get('/', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const role = req.user.role;
  let rows;
  if (role === 'Student') {
    const [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id=:uid', { uid: req.user.id });
    if (!stu) return res.json([]);
    const [sr] = await pool.query(`
      SELECT c.*, u.first_name, u.last_name, st.name AS assigned_staff_name
      FROM complaints c
      JOIN students s ON s.student_id=c.student_id
      JOIN users u ON u.id=s.user_id
      LEFT JOIN staff st ON st.staff_id=c.assigned_to_staff_id
      WHERE c.student_id = :sid
      ORDER BY c.created_at DESC`, { sid: stu.student_id });
    rows = sr;
  } else {
    const [ar] = await pool.query(`
      SELECT c.*, u.first_name, u.last_name, st.name AS assigned_staff_name
      FROM complaints c
      JOIN students s ON s.student_id=c.student_id
      JOIN users u ON u.id=s.user_id
      LEFT JOIN staff st ON st.staff_id=c.assigned_to_staff_id
      ORDER BY c.created_at DESC`);
    rows = ar;
  }
  res.json(rows);
});

// explicit student-only list
router.get('/my', requireAuth(['Student']), async (req, res) => {
  const [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id=:uid', { uid: req.user.id });
  if (!stu) return res.json([]);
  const [rows] = await pool.query(`
    SELECT c.*, u.first_name, u.last_name, st.name AS assigned_staff_name
    FROM complaints c
    JOIN students s ON s.student_id=c.student_id
    JOIN users u ON u.id=s.user_id
    LEFT JOIN staff st ON st.staff_id=c.assigned_to_staff_id
    WHERE c.student_id = :sid
    ORDER BY c.created_at DESC`, { sid: stu.student_id });
  res.json(rows);
});

router.put('/:id/status', requireAuth(['Admin','Warden']), async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to_staff_id } = req.body;
  await pool.query(
    'UPDATE complaints SET status=:s, assigned_to_staff_id=:aid, updated_at=NOW() WHERE complaint_id=:id',
    { s: status, aid: assigned_to_staff_id || null, id }
  );

  // If resolved, notify the student who created it
  if (String(status) === 'Resolved') {
    (async () => {
      try {
        const [[c]] = await pool.query(
          `SELECT c.title, c.student_id, u.email, u.first_name, u.last_name
           FROM complaints c
           JOIN students s ON s.student_id=c.student_id
           JOIN users u ON u.id=s.user_id
           WHERE c.complaint_id=:id`,
          { id }
        );
        if (c && c.email) {
          const studentName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Student';
          const mail = templates.complaintResolved({ title: c.title, studentName });
          await sendEmail({ to: c.email, ...mail });
        }
      } catch (err) {
        console.error('Failed to send complaint resolved email:', err.message);
      }
    })();
  }

  res.json({ message: 'Updated' });
});

export default router;
