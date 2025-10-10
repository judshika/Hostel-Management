import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/mark', requireAuth(['Admin','Warden']), async (req, res) => {
  const { date, session, marks } = req.body; // marks: [{student_id, status}]
  for (const m of marks) {
    await pool.query(
      'INSERT INTO attendance (student_id, date, session, status) VALUES (:sid,:d,:s,:st) ON DUPLICATE KEY UPDATE status=:st',
      { sid: m.student_id, d: date, s: session, st: m.status }
    );
  }
  res.json({ message: 'Attendance saved' });
});

// No self-mark routes: students are view-only for attendance

router.get('/summary', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const { month } = req.query; // 'YYYY-MM'
  let where = 'WHERE DATE_FORMAT(a.date,\'%Y-%m\') = :m';
  const params = { m: month };

  if (req.user.role === 'Student') {
    const [[stu]] = await pool.query(
      'SELECT student_id FROM students WHERE user_id = :uid',
      { uid: req.user.id }
    );
    if (!stu) return res.json([]);
    where += ' AND a.student_id = :sid';
    params.sid = stu.student_id;
  }

  const [rows] = await pool.query(
    `SELECT 
        a.student_id,
        DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
        -- Day Session
        SUM(a.session='Day' AND a.status='Present') AS present_day,
        SUM(a.session='Day' AND a.status='Absent') AS absent_day,
        -- Night Session
        SUM(a.session='Night' AND a.status='Present') AS present_night,
        SUM(a.session='Night' AND a.status='Absent') AS absent_night,
        -- Combined totals
        SUM(a.status='Present') AS present,
        SUM(a.status='Absent') AS absent,
        u.first_name,
        u.last_name
     FROM attendance a
     LEFT JOIN students s ON s.student_id = a.student_id
     LEFT JOIN users u ON u.id = s.user_id
     ${where}
     GROUP BY a.student_id, a.date, u.first_name, u.last_name
     ORDER BY a.date DESC`,
    params
  );

  res.json(rows);
});


export default router;
