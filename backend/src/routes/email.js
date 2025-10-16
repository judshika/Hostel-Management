import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
} = process.env;

// ✅ Gmail-compatible transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST, // smtp.gmail.com
  port: Number(SMTP_PORT), // 465
  secure: Number(SMTP_PORT) === 465, // true for Gmail SSL
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS, // Gmail App Password (no spaces)
  },
});

// ✅ Generic mail sender
export async function sendEmail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM || `"SmartHostel" <no-reply@smarthostel.app>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`📧 Mail sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
    throw err;
  }
}

// ✅ Templates
export const templates = {
  studentWelcome: ({ name, email, password }) => ({
    subject: "Welcome to SmartHostel Portal",
    text: `Hi ${name},

Your hostel account has been created successfully.

Login Details:
Email: ${email}
Password: ${password}

Please log in and change your password soon.

– SmartHostel Management System`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#333">
        <h2>Welcome, ${name}!</h2>
        <p>Your <b>SmartHostel</b> account has been created successfully.</p>
        <p><b>Login Details:</b></p>
        <ul>
          <li>Email: <b>${email}</b></li>
          <li>Password: <b>${password}</b></li>
        </ul>
        <p>Please log in to the student portal and change your password soon.</p>
        <p style="color:#888;font-size:13px;margin-top:20px">
          – SmartHostel Management System
        </p>
      </div>
    `,
  }),
  complaintNew: ({ title, studentName, studentEmail, createdAt }) => ({
    subject: `New Complaint Submitted: ${title}`,
    text: `A new complaint has been submitted by ${studentName} (${studentEmail}).

Title: ${title}
Submitted: ${createdAt}

Please review it in the SmartHostel admin/warden portal.`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#333">
        <h3>New Complaint Submitted</h3>
        <p><b>Student:</b> ${studentName} &lt;${studentEmail}&gt;</p>
        <p><b>Title:</b> ${title}</p>
        <p><b>Submitted:</b> ${createdAt}</p>
        <p>Please review it in the SmartHostel admin/warden portal.</p>
      </div>
    `,
  }),
  complaintResolved: ({ title, studentName }) => ({
    subject: `Your Complaint Resolved: ${title}`,
    text: `Hello ${studentName},

Your complaint "${title}" has been marked as Resolved.

If anything still needs attention, please reply or submit a new complaint.

– SmartHostel Management System`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#333">
        <p>Hello ${studentName},</p>
        <p>Your complaint <b>"${title}"</b> has been marked as <b>Resolved</b>.</p>
        <p>If anything still needs attention, please reply or submit a new complaint.</p>
        <p style="color:#888;font-size:13px;margin-top:20px">– SmartHostel Management System</p>
      </div>
    `,
  }),
};
