import express from "express";
import { pool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import bcrypt from "bcryptjs";
import { sendEmail, templates } from "../routes/email.js";
import { notifyRoles } from "../services/notify.js";

const router = express.Router();

/**
 * ✅ Create Student (Admin only)
 * - Uses the password given by Admin (no random)
 * - Saves bcrypt hash to DB
 * - Sends welcome email with the same plain password
 */
router.post("/", requireAuth(["Admin"]), async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      nic_number,
      guardian_name,
      guardian_phone,
      address,
    } = req.body || {};

    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // 🔹 Use the exact password provided by Admin
    const plain = String(password);
    const hash = await bcrypt.hash(plain, 10);

    // 🔹 Insert into users table
    const [u] = await pool.query(
      `INSERT INTO users (role, email, password_hash, first_name, last_name, phone, nic_number)
       VALUES ('Student', :email, :hash, :first, :last, :phone, :nic)`,
      {
        email,
        hash,
        first: first_name || null,
        last: last_name || null,
        phone: phone || null,
        nic: nic_number || null,
      }
    );

    // 🔹 Insert into students table
    await pool.query(
      `INSERT INTO students (user_id, guardian_name, guardian_phone, address)
       VALUES (:uid, :gname, :gphone, :addr)`,
      {
        uid: u.insertId,
        gname: guardian_name || null,
        gphone: guardian_phone || null,
        addr: address || null,
      }
    );

    // 🔹 Fetch the created student record (joined)
    const [rows] = await pool.query(
      `SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
       FROM students s JOIN users u ON u.id=s.user_id
       WHERE u.id = :uid`,
      { uid: u.insertId }
    );
    const created = rows && rows[0];

    // 🔹 Send Welcome Email to student (with the same password)
    try {
      const name = `${first_name || ""} ${last_name || ""}`.trim() || "Student";
      const mail = templates.studentWelcome({ name, email, password: plain });
      await sendEmail({ to: email, ...mail });
      console.log(`📧 Welcome email sent to ${email}`);
    } catch (err) {
      console.error("❌ Email send failed:", err.message);
    }

    // 🔹 Return response (no generated_password since we used the given one)
    res.status(201).json({
      student: created,
    });
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY")
      return res.status(400).json({ message: "Email already used" });
    console.error(e);
    res.status(500).json({ message: "Failed to create student" });
  }
});

/**
 * ✅ Get Current Student Profile
 */
router.get("/me", requireAuth(["Student"]), async (req, res) => {
  const userId = req.user.id;

  let [[stu]] = await pool.query(
    `SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
     FROM students s JOIN users u ON u.id=s.user_id
     WHERE s.user_id = :uid`,
    { uid: userId }
  );

  if (!stu) {
    const [[user]] = await pool.query(
      "SELECT id, role, email, first_name, last_name, phone, nic_number, profile_photo FROM users WHERE id=:id",
      { id: userId }
    );

    if (!user || user.role !== "Student")
      return res.status(404).json({ message: "Student user not found" });

    await pool.query("INSERT IGNORE INTO students (user_id) VALUES (:uid)", {
      uid: userId,
    });

    [[stu]] = await pool
      .query(
        `SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
         FROM students s JOIN users u ON u.id=s.user_id
         WHERE s.user_id = :uid`,
        { uid: userId }
      )
      .then((r) => r[0]);
  }

  const [[alloc]] = await pool.query(
    `SELECT a.*, r.room_number, r.room_id,
            f.name AS floor, b.name AS block
     FROM allocations a
     JOIN rooms r ON r.room_id=a.room_id
     JOIN floors f ON f.floor_id=r.floor_id
     JOIN blocks b ON b.block_id=f.block_id
     WHERE a.student_id=:sid AND a.is_active=1
     ORDER BY a.start_date DESC
     LIMIT 1`,
    { sid: stu.student_id }
  );

  res.json({ student: stu, allocation: alloc || null });
});

/**
 * ✅ Get All Students (Admin/Warden)
 */
router.get("/", requireAuth(["Admin", "Warden"]), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.*, u.email, u.first_name, u.last_name, u.phone, u.nic_number, u.profile_photo
    FROM students s JOIN users u ON u.id=s.user_id
    ORDER BY u.first_name, u.last_name
  `);
  res.json(rows);
});

/**
 * ✅ Update Student (Admin/Warden/Student)
 */
router.put(
  "/:student_id",
  requireAuth(["Admin", "Warden", "Student"]),
  async (req, res) => {
    const { student_id } = req.params;
    const {
      guardian_name,
      guardian_phone,
      address,
      first_name,
      last_name,
      phone,
      nic_number,
    } = req.body || {};

    // If the caller is a student, restrict to self
    if (req.user.role === "Student") {
      const [[me]] = await pool.query(
        "SELECT student_id FROM students WHERE user_id=:uid",
        { uid: req.user.id }
      );
      if (!me || String(me.student_id) !== String(student_id)) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    // Fetch related user ID
    const [[stu]] = await pool.query(
      "SELECT user_id FROM students WHERE student_id=:id",
      { id: student_id }
    );
    if (!stu) return res.status(404).json({ message: "Student not found" });

    // Update students table (only provided fields)
    const sSets = [];
    const sParams = { id: student_id };
    if (Object.prototype.hasOwnProperty.call(req.body, "guardian_name")) {
      sSets.push("guardian_name=:g");
      sParams.g = guardian_name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "guardian_phone")) {
      sSets.push("guardian_phone=:p");
      sParams.p = guardian_phone;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "address")) {
      sSets.push("address=:a");
      sParams.a = address;
    }
    if (sSets.length) {
      try {
        await pool.query(
          `UPDATE students SET ${sSets.join(", ")} WHERE student_id=:id`,
          sParams
        );
      } catch (e) {
        return res.status(500).json({ message: "Failed to update student" });
      }
    }

    // Update users table (first_name, last_name, etc.) only if provided
    const uSets = [];
    const uParams = { uid: stu.user_id };
    if (Object.prototype.hasOwnProperty.call(req.body, "first_name")) {
      uSets.push("first_name=:fn");
      uParams.fn = first_name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "last_name")) {
      uSets.push("last_name=:ln");
      uParams.ln = last_name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "phone")) {
      uSets.push("phone=:ph");
      uParams.ph = phone;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "nic_number")) {
      uSets.push("nic_number=:nic");
      uParams.nic = nic_number;
    }
    if (uSets.length) {
      try {
        await pool.query(
          `UPDATE users SET ${uSets.join(", ")} WHERE id=:uid`,
          uParams
        );
      } catch (e) {
        return res.status(500).json({ message: "Failed to update user" });
      }
    }

    // If the caller is a Student (self-edit), notify Admin/Warden
    if (req.user.role === "Student") {
      (async () => {
        try {
          const [[u]] = await pool.query(
            "SELECT first_name, last_name, email FROM users WHERE id=:id",
            { id: stu.user_id }
          );
          const studentName = `${u?.first_name || ""} ${u?.last_name || ""}`.trim() || "Student";
          const studentEmail = u?.email || "";
          const link = `${process.env.APP_BASE_URL || ""}/students`;
          const updatedKeys = [
            ...sSets.map(s=>s.split('=')[0]),
            ...uSets.map(s=>s.split('=')[0])
          ].map(k => k.replace(/^[a-z_]+\./, '')).join(', ');

          // Email recipients controlled by env, default Admin + Warden
          const rolesEnv = (process.env.NOTIFY_ROLES_ON_PROFILE_EDIT || 'Admin,Warden')
            .split(',').map(s => s.trim()).filter(Boolean);

          // Email
          const mail = templates.studentProfileUpdated({ studentName, studentEmail, fields: updatedKeys, link });
          const [recips] = await pool.query(
            `SELECT email FROM users WHERE role IN (${rolesEnv.map((_,i)=>`:r${i}`).join(',')}) AND is_active=1 AND email IS NOT NULL`,
            Object.fromEntries(rolesEnv.map((r,i)=>[`r${i}`, r]))
          );
          const list = (recips || []).map(r => r.email).filter(Boolean);
          if (list.length > 0) {
            await sendEmail({ to: list.join(','), ...mail });
          }

          // In-app notifications
          await notifyRoles(rolesEnv, {
            title: `Student updated profile: ${studentName}`,
            //body: updatedKeys ? `Fields: ${updatedKeys}` : '',
            link: '/students',
          });
        } catch (err) {
          console.error('Failed to send profile update notifications:', err.message);
        }
      })();
    }

    res.json({ message: "Updated" });
  }
);

/**
 * ✅ Delete Student (Admin/Warden)
 */
router.delete(
  "/:student_id",
  requireAuth(["Admin", "Warden"]),
  async (req, res) => {
    const { student_id } = req.params;
    await pool.query("DELETE FROM students WHERE student_id=:id", {
      id: student_id,
    });
    res.json({ message: "Deleted" });
  }
);

export default router;
