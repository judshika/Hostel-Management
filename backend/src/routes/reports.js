import express from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/occupancy.pdf', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT b.name AS block, f.name AS floor, r.room_number, r.capacity, r.status
    FROM rooms r JOIN floors f ON f.floor_id=r.floor_id JOIN blocks b ON b.block_id=f.block_id
    ORDER BY b.name, f.name, r.room_number
  `);
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);
  doc.fontSize(16).text('Room Occupancy Report', { underline: true });
  doc.moveDown();
  rows.forEach(r => doc.fontSize(12).text(`${r.block}-${r.floor} Room ${r.room_number} | Capacity ${r.capacity} | ${r.status}`));
  doc.end();
});

router.get('/dues.xlsx', requireAuth(['Admin','Warden']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT u.first_name, u.last_name, b.month_year, b.total, b.status
    FROM bills b JOIN students s ON s.student_id=b.student_id JOIN users u ON u.id=s.user_id
    WHERE b.status != 'PAID' ORDER BY b.month_year DESC
  `);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Fee Dues');
  ws.addRow(['First Name','Last Name','Month','Total','Status']);
  rows.forEach(r => ws.addRow([r.first_name, r.last_name, r.month_year, r.total, r.status]));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="dues.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

export default router;
