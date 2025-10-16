import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendEmail, templates } from '../routes/email.js';
import { notifyRoles, notifyUser } from '../services/notify.js';

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

  // Fire-and-forget notifications (email + in-app) to Admins/Wardens
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
      const link = `${process.env.APP_BASE_URL || ''}/complaints`;
      const mail = templates.complaintNew({ title, description, studentName, studentEmail, createdAt, link });

      // Allow role control via env: NOTIFY_ROLES_ON_COMPLAINT=Admin,Warden|Warden|Admin
      const rolesEnv = (process.env.NOTIFY_ROLES_ON_COMPLAINT || 'Admin,Warden')
        .split(',').map(s => s.trim()).filter(Boolean);

      // Email
      const [recips] = await pool.query(
        `SELECT email FROM users WHERE role IN (${rolesEnv.map((_,i)=>`:r${i}`).join(',')}) AND is_active=1 AND email IS NOT NULL`,
        Object.fromEntries(rolesEnv.map((r,i)=>[`r${i}`, r]))
      );
      const list = (recips || []).map(r => r.email).filter(Boolean);
      if (list.length > 0) { await sendEmail({ to: list.join(','), ...mail }); }

      // In-app notifications
      await notifyRoles(rolesEnv, {
        title: `New complaint: ${title}`,
        body: description || '',
        link: '/complaints',
      });
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

  // If resolved, notify the student who created it (email + in-app)
  if (String(status) === 'Resolved') {
    (async () => {
      try {
        const [[c]] = await pool.query(
          `SELECT c.title, c.student_id, u.email, u.first_name, u.last_name, u.id AS user_id
           FROM complaints c
           JOIN students s ON s.student_id=c.student_id
           JOIN users u ON u.id=s.user_id
           WHERE c.complaint_id=:id`,
          { id }
        );
        if (c && c.email) {
          const studentName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Student';
          const link = `${process.env.APP_BASE_URL || ''}/complaints`;
          const mail = templates.complaintResolved({ title: c.title, studentName, link });
          await sendEmail({ to: c.email, ...mail });
          await notifyUser(c.user_id, {
            title: `Complaint resolved: ${c.title}`,
            body: 'Your complaint has been marked as Resolved.',
            link: '/complaints',
          });
        }
      } catch (err) {
        console.error('Failed to send complaint resolved email:', err.message);
      }
    })();
  }

  res.json({ message: 'Updated' });
});

export default router;
