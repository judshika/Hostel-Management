import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// List active fee structures (for selection)
router.get('/structures', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM fee_structures WHERE is_active=1 ORDER BY name');
  res.json(rows);
});

router.post('/structures', requireAuth(['Admin']), async (req, res) => {
  const { name, room_type, student_type, monthly_amount } = req.body;
  const [r] = await pool.query('INSERT INTO fee_structures (name, room_type, student_type, monthly_amount) VALUES (:n,:rt,:st,:m)',
    { n: name, rt: room_type || null, st: student_type || null, m: monthly_amount });
  res.json({ fee_id: r.insertId });
});

// Create a single bill for a student
router.post('/create', requireAuth(['Admin', 'Warden']), async (req, res) => {
  let { student_id, month_year, amount, discount } = req.body;

  // ✅ Validation
  if (!student_id || !month_year || amount == null) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  // ✅ Sanitize month_year to 'YYYY-MM'
  month_year = month_year.substring(0, 7);

  const disc = parseFloat(discount || 0);
  const amt = parseFloat(amount);
  const total = Math.max(0, amt - disc);

  try {
    const [r] = await pool.query(
      `INSERT INTO bills (student_id, month_year, amount, discount, total, status)
       VALUES (:sid, :my, :a, :d, :t, 'UNPAID')`,
      { sid: student_id, my: month_year, a: amt, d: disc, t: total }
    );
    res.json({ bill_id: r.insertId });
  } catch (e) {
    // ✅ Improved error logging
    console.error('Bill creation error:', e);

    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Bill already exists for this month' });
    }
    res.status(500).json({ message: 'Failed to create bill' });
  }
});


router.post('/generate', requireAuth(['Admin','Warden']), async (req, res) => {
  const { month_year, default_fee_id } = req.body; // 'YYYY-MM'
  const [[fee]] = await pool.query('SELECT * FROM fee_structures WHERE fee_id=:id AND is_active=1', { id: default_fee_id });
  if (!fee) return res.status(400).json({ message: 'Fee not found' });
  const [students] = await pool.query('SELECT student_id FROM students');
  let created = 0;
  for (const s of students) {
    const amount = fee.monthly_amount;
    try {
      await pool.query(
        'INSERT INTO bills (student_id, month_year, amount, discount, total, status) VALUES (:sid,:my,:a,0,:a,"UNPAID")',
        { sid: s.student_id, my: month_year, a: amount }
      );
      created++;
    } catch (e) { /* skip duplicates */ }
  }
  res.json({ message: 'Bills generated', created });
});

router.get('/bills', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT 
      b.*, 
      u.first_name, 
      u.last_name,
      IFNULL(paidagg.paid, 0) AS paid,
      GREATEST(0, b.total - IFNULL(paidagg.paid, 0)) AS balance
    FROM bills b
    JOIN students s ON s.student_id = b.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN (
      SELECT bill_id, SUM(amount) AS paid 
      FROM payments 
      GROUP BY bill_id
    ) paidagg ON paidagg.bill_id = b.bill_id
    ORDER BY b.created_at DESC
  `);
  res.json(rows);
});

// Pay a bill; students can only pay their own bills
router.post('/pay', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  const { bill_id, method, reference, amount } = req.body;
  const [[bill]] = await pool.query('SELECT * FROM bills WHERE bill_id=:id', { id: bill_id });
  if (!bill) return res.status(404).json({ message: 'Bill not found' });
  if (req.user.role === 'Student') {
    const [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id = :uid', { uid: req.user.id });
    if (!stu || stu.student_id !== bill.student_id) return res.status(403).json({ message: 'Cannot pay for this bill' });
  }
  await pool.query('INSERT INTO payments (bill_id, method, reference, amount) VALUES (:id,:m,:r,:a)', 
    { id: bill_id, m: method, r: reference || null, a: amount });
  const [[agg]] = await pool.query('SELECT SUM(amount) AS paid FROM payments WHERE bill_id=:id', { id: bill_id });
  const paid = parseFloat(agg.paid || 0);
  let status = 'UNPAID';
  if (paid <= 0) status = 'UNPAID';
  else if (paid < parseFloat(bill.total)) status = 'PARTIAL';
  else status = 'PAID';
  await pool.query('UPDATE bills SET status=:s WHERE bill_id=:id', { s: status, id: bill_id });
  res.json({ message: 'Payment saved', status });
});

// Student: view own bills
router.get('/my', requireAuth(['Student']), async (req, res) => {
  let [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id = :uid', { uid: req.user.id });
  if (!stu) {
    await pool.query('INSERT IGNORE INTO students (user_id) VALUES (:uid)', { uid: req.user.id });
    [[stu]] = await pool.query('SELECT student_id FROM students WHERE user_id = :uid', { uid: req.user.id }).then(r=>r[0]);
  }
  if (!stu) return res.json([]);
  const [rows] = await pool.query(
    `SELECT 
       b.*,
       IFNULL(paidagg.paid, 0) AS paid,
       GREATEST(0, b.total - IFNULL(paidagg.paid, 0)) AS balance
     FROM bills b
     LEFT JOIN (
       SELECT bill_id, SUM(amount) AS paid
       FROM payments
       GROUP BY bill_id
     ) paidagg ON paidagg.bill_id = b.bill_id
     WHERE b.student_id = :sid
     ORDER BY b.created_at DESC`, { sid: stu.student_id }
  );
  res.json(rows);
});

export default router;
