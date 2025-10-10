import { pool } from './config/db.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

async function run() {
  const schema = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'sql', 'schema.sql'), 'utf-8');
  for (const stmt of schema.split(';')) {
    const s = stmt.trim();
    if (s) await pool.query(s);
  }
  // Seed default registration codes
  await pool.query("INSERT IGNORE INTO registration_codes (role, code, is_active) VALUES ('Admin','ADMIN-2025',1),('Warden','WARDEN-2025',1),('Student','STUDENT-2025',1)");
  // Seed an admin
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query("INSERT IGNORE INTO users (id, role, email, password_hash, first_name, last_name) VALUES (1,'Admin','admin@donbosco.lk',:h,'Hostel','Admin')", { h: hash });
  console.log('Seed complete');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
