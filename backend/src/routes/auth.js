import express from 'express';
import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { sendEmail } from '../utils/email.js';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
dotenv.config();

const router = express.Router();

// Multer setup for profile photo uploads
const PROFILES_DIR = path.join(process.cwd(), 'uploads', 'profiles');
try { if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true }); } catch {}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PROFILES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, fieldSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image\/jpeg|image\/pjpeg|image\/jpg|image\/png|image\/gif|image\/webp)$/.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image files are allowed'));
  }
});

router.post('/register', upload.fields([{ name: 'profile_photo', maxCount: 1 }, { name: 'photo', maxCount: 1 }]), async (req, res) => {
  const { role, email, password, first_name, last_name, phone, guardian_name, guardian_phone, address, nic_number } = req.body;
  if (!role || !email || !password) return res.status(400).json({ message: 'Missing fields' });

  // Enforce single-admin and first-user-must-be-admin rules
  const [[adm]] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role='Admin'", {});
  const adminExists = Number(adm?.c || 0) > 0;
  if (adminExists && role === 'Admin') {
    return res.status(400).json({ message: 'Admin already exists' });
  }
  if (!adminExists && role !== 'Admin') {
    return res.status(400).json({ message: 'First user must be Admin' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    let photoPath = null;
    const fileFromFields = (req.files && (req.files.profile_photo?.[0] || req.files.photo?.[0])) || null;
    if (fileFromFields && fileFromFields.filename) {
      photoPath = '/uploads/profiles/' + fileFromFields.filename; // public URL path
    } else if (typeof req.body.profile_photo === 'string' || typeof req.body.profile_photo_b64 === 'string' || typeof req.body.photo_data === 'string') {
      const val = req.body.profile_photo_b64 || req.body.photo_data || req.body.profile_photo;
      // Accept base64 Data URL fallback
      const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i.exec(val);
      if (m) {
        const ext = m[1] === 'jpg' ? 'jpeg' : m[1];
        const buf = Buffer.from(m[2], 'base64');
        const name = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
        const abs = path.join(PROFILES_DIR, name);
        try { fs.writeFileSync(abs, buf); photoPath = '/uploads/profiles/' + name; } catch {}
      } else if (/^\/uploads\//.test(val)) {
        photoPath = val; // already a stored path
      }
    }
    const [u] = await pool.query(
      `INSERT INTO users (role, email, password_hash, first_name, last_name, phone, nic_number, profile_photo) 
       VALUES (:role,:email,:hash,:first,:last,:phone,:nic,:photo)`,
      { role, email, hash, first: first_name || null, last: last_name || null, phone: phone || null, nic: nic_number || null, photo: photoPath }
    );

    if (role === 'Student') {
      await pool.query(
        `INSERT INTO students (user_id, guardian_name, guardian_phone, address) 
         VALUES (:uid, :gname, :gphone, :addr)`,
        { uid: u.insertId, gname: guardian_name || null, gphone: guardian_phone || null, addr: address || null }
      );
    }

    const token = jwt.sign({ id: u.insertId, email, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: u.insertId, email, role, first_name, last_name, phone: phone || null, nic_number: nic_number || null, profile_photo: photoPath } });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already used' });
    res.status(500).json({ message: 'Registration error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = :email AND is_active = 1', { email });
  if (!rows.length) return res.status(400).json({ message: 'Invalid credentials' });
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name, phone: user.phone, nic_number: user.nic_number, profile_photo: user.profile_photo } });
});

router.post('/password-reset', async (req, res) => {
  const { email } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = :email', { email });
  if (!rows.length) return res.json({ message: 'If the email exists, a link will be sent.' });
  const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const resetLink = `${process.env.APP_BASE_URL}/reset?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Password Reset - SmartHostel',
    html: `<p>Click to reset password: <a href="${resetLink}">${resetLink}</a></p>`
  });
  res.json({ message: 'Email sent if account exists' });
});

export default router;
// Query whether an Admin user already exists
router.get('/admin-exists', async (req, res) => {
  try {
    const [[adm]] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role='Admin'", {});
    const exists = Number(adm?.c || 0) > 0;
    res.json({ exists });
  } catch (e) {
    res.status(500).json({ message: 'Failed to check admin status' });
  }
});

// Update current user's profile photo
router.post('/profile-photo', requireAuth(['Admin','Warden','Student']), upload.single('photo'), async (req, res) => {
  try {
    let pathUrl = null;
    if (req.file && req.file.filename) {
      pathUrl = '/uploads/profiles/' + req.file.filename;
    } else {
      // Fallback: accept base64 data in body under photo_data or profile_photo_b64
      const val = req.body?.photo_data || req.body?.profile_photo_b64 || req.body?.photo;
      if (typeof val === 'string') {
        const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(val);
        if (m) {
          const ext = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
          const buf = Buffer.from(m[2], 'base64');
          const name = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
          const abs = path.join(PROFILES_DIR, name);
          try { fs.writeFileSync(abs, buf); pathUrl = '/uploads/profiles/' + name; } catch {}
        }
      }
    }
    if (!pathUrl) return res.status(400).json({ message: 'No photo uploaded' });
    
    // Save to user
    await pool.query('UPDATE users SET profile_photo = :p WHERE id = :id', { p: pathUrl, id: req.user.id });
    await pool.query('UPDATE users SET profile_photo = :p WHERE id = :id', { p: pathUrl, id: req.user.id });
    res.json({ profile_photo: pathUrl });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update photo' });
  }
});
