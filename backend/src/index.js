import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { pool } from './config/db.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import studentRoutes from './routes/students.js';
import feeRoutes from './routes/fees.js';
import attendanceRoutes from './routes/attendance.js';
import complaintRoutes from './routes/complaints.js';
import staffRoutes from './routes/staff.js';
import reportRoutes from './routes/reports.js';
import codeRoutes from './routes/codes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// Static hosting for uploaded files
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {}
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (req,res)=>res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/codes', codeRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
  // test DB
  try { await pool.query('SELECT 1'); console.log('DB connected'); } catch (e) { console.error('DB error', e.message); }
  console.log('SmartHostel API listening on ' + PORT);
});
