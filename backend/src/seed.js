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
  // No default admin or registration codes. The first registered user must be Admin.
  console.log('Seed complete');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
