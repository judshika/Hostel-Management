import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper: recompute and update room status based on active allocations vs capacity
async function recomputeRoomStatus(roomId) {
  // Fetch current room capacity and status
  const [[room]] = await pool.query(
    'SELECT room_id, capacity, status FROM rooms WHERE room_id=:rid',
    { rid: roomId }
  );
  if (!room) return; // no-op if room missing

  // Maintenance overrides computed occupancy
  if (room.status === 'Maintenance') return;

  const [[cnt]] = await pool.query(
    'SELECT COUNT(*) AS active_count FROM allocations WHERE room_id=:rid AND is_active=1',
    { rid: roomId }
  );
  const activeCount = Number(cnt?.active_count || 0);
  const nextStatus = activeCount >= Number(room.capacity) ? 'Occupied' : 'Vacant';
  if (nextStatus !== room.status) {
    await pool.query('UPDATE rooms SET status=:st WHERE room_id=:rid', { st: nextStatus, rid: roomId });
  }
}

// Fetch single room details
router.get('/rooms/:id', requireAuth(['Admin','Warden']), async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.room_id, r.floor_id, r.room_number, r.capacity, r.status,
              f.name AS floor, b.block_id, b.name AS block
         FROM rooms r
         JOIN floors f ON f.floor_id = r.floor_id
         JOIN blocks b ON b.block_id = f.block_id
        WHERE r.room_id = :id`,
      { id }
    );
    if (!rows.length) return res.status(404).json({ message: 'Room not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch room' });
  }
});

// Update room details (number, capacity, status, optional floor)
router.put('/rooms/:id', requireAuth(['Admin','Warden']), async (req, res) => {
  const { id } = req.params;
  const { room_number, capacity, status, floor_id } = req.body || {};
  const fields = [];
  const params = { id };
  if (room_number !== undefined) { fields.push('room_number = :room_number'); params.room_number = room_number; }
  if (capacity !== undefined) { fields.push('capacity = :capacity'); params.capacity = capacity; }
  if (status !== undefined) { fields.push('status = :status'); params.status = status; }
  if (floor_id !== undefined) { fields.push('floor_id = :floor_id'); params.floor_id = floor_id; }

  if (!fields.length) return res.status(400).json({ message: 'No fields to update' });

  try {
    const [result] = await pool.query(
      `UPDATE rooms SET ${fields.join(', ')} WHERE room_id = :id`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Room not found' });
    // Keep occupancy-driven status consistent unless explicitly set to Maintenance
    if (status !== 'Maintenance') {
      await recomputeRoomStatus(id);
    }
    res.json({ message: 'Room updated' });
  } catch (e) {
    // Handle unique constraint errors gracefully
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate room number on this floor' });
    }
    res.status(500).json({ message: 'Failed to update room' });
  }
});

router.post('/blocks', requireAuth(['Admin']), async (req, res) => {
  const { name } = req.body;
  const [r] = await pool.query('INSERT INTO blocks (name) VALUES (:name)', { name });
  res.json({ block_id: r.insertId });
});

// List blocks
router.get('/blocks', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query('SELECT block_id, name FROM blocks ORDER BY name');
  res.json(rows);
});

router.post('/floors', requireAuth(['Admin','Warden']), async (req, res) => {
  const { block_id, name } = req.body;
  const [r] = await pool.query('INSERT INTO floors (block_id, name) VALUES (:block_id,:name)', { block_id, name });
  res.json({ floor_id: r.insertId });
});

// List floors (optionally filter by block_id)
router.get('/floors', requireAuth(['Admin','Warden']), async (req, res) => {
  const { block_id } = req.query;
  const where = block_id ? 'WHERE f.block_id = :bid' : '';
  const params = block_id ? { bid: block_id } : {};
  const [rows] = await pool.query(
    `SELECT f.floor_id, f.block_id, f.name, b.name AS block_name
     FROM floors f JOIN blocks b ON b.block_id = f.block_id
     ${where}
     ORDER BY b.name, f.name`,
    params
  );
  res.json(rows);
});

router.post('/rooms', requireAuth(['Admin','Warden']), async (req, res) => {
  const { floor_id, room_number, capacity } = req.body;
  const [r] = await pool.query('INSERT INTO rooms (floor_id, room_number, capacity) VALUES (:floor_id,:room_number,:capacity)', { floor_id, room_number, capacity });
  res.json({ room_id: r.insertId });
});

router.get('/rooms-grid', requireAuth(['Admin','Warden','Student']), async (req, res) => {
  // Compute derived status from active allocations vs capacity, unless Maintenance
  const role = req.user?.role || 'Student';
  const [rows] = await pool.query(`
    SELECT
      r.room_id,
      b.name AS block,
      f.name AS floor,
      r.room_number,
      r.capacity,
      CASE
        WHEN r.status = 'Maintenance' THEN 'Maintenance'
        WHEN IFNULL(ac.active_count, 0) >= r.capacity THEN 'Occupied'
        WHEN IFNULL(ac.active_count, 0) = 0 THEN 'Vacant'
        ELSE 'Partial'
      END AS status,
      IFNULL(ac.active_count, 0) AS active_count,
      CASE WHEN :role IN ('Admin','Warden') THEN occ.occupant_names ELSE NULL END AS occupant_names
    FROM rooms r
    JOIN floors f ON f.floor_id = r.floor_id
    JOIN blocks b ON b.block_id = f.block_id
    LEFT JOIN (
      SELECT room_id, COUNT(*) AS active_count
      FROM allocations
      WHERE is_active = 1
      GROUP BY room_id
    ) ac ON ac.room_id = r.room_id
    LEFT JOIN (
      SELECT a.room_id,
             GROUP_CONCAT(TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')))
                          ORDER BY u.first_name SEPARATOR ', ') AS occupant_names
      FROM allocations a
      JOIN students s ON s.student_id = a.student_id
      JOIN users u ON u.id = s.user_id
      WHERE a.is_active = 1
      GROUP BY a.room_id
    ) occ ON occ.room_id = r.room_id
    ORDER BY b.name, f.name, r.room_number
  `, { role });
  res.json(rows);
});

router.post('/allocate', requireAuth(['Admin','Warden']), async (req, res) => {
  const { student_id, room_id, start_date } = req.body;
  await pool.query('UPDATE allocations SET is_active=0 WHERE student_id=:sid AND is_active=1', { sid: student_id });
  const [r] = await pool.query(
    'INSERT INTO allocations (student_id, room_id, start_date, is_active) VALUES (:sid,:rid,:sd,1)',
    { sid: student_id, rid: room_id, sd: start_date }
  );
  // Recompute room status based on actual occupancy
  await recomputeRoomStatus(room_id);
  res.json({ allocation_id: r.insertId });
});

router.post('/vacate', requireAuth(['Admin','Warden']), async (req, res) => {
  const { allocation_id, end_date } = req.body;
  const [[alloc]] = await pool.query('SELECT * FROM allocations WHERE allocation_id=:id', { id: allocation_id });
  if (!alloc) return res.status(404).json({ message: 'Not found' });
  await pool.query('UPDATE allocations SET is_active=0, end_date=:ed WHERE allocation_id=:id', { id: allocation_id, ed: end_date });
  // Recompute room status after vacating
  await recomputeRoomStatus(alloc.room_id);
  res.json({ message: 'Vacated' });
});

export default router;
