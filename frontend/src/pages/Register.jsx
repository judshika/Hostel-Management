import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import { useNavigate } from 'react-router-dom';
import { API, setToken } from '../api';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css'; // reuse login styles + meter bits added below

export default function Register() {
  const [role, setRole] = useState('Student');
  const [adminExists, setAdminExists] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [nicNumber, setNicNumber] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [agree, setAgree] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const nav = useNavigate();
  const { setUser } = useAuth();

  // Determine if Admin already exists to control role selection
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await API.get('/auth/admin-exists');
        if (!mounted) return;
        const exists = Boolean(data?.exists);
        setAdminExists(exists);
        if (!exists) setRole('Admin');
        if (exists && role === 'Admin') setRole('Student');
      } catch (e) {
        // Assume admin exists on failure to avoid exposing Admin option
        if (!mounted) return;
        setAdminExists(true);
        if (role === 'Admin') setRole('Student');
      }
    })();
    return () => { mounted = false };
  }, []);

  // --- validation ---
  const emailError = useMemo(() => {
    if (!email) return '';
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return ok ? '' : 'Enter a valid email address';
  }, [email]);

  const pwScore = useMemo(() => scorePassword(password), [password]);
  const pwMatchError = useMemo(() => {
    if (!password2) return '';
    return password === password2 ? '' : 'Passwords do not match';
  }, [password, password2]);

  const canSubmit = useMemo(() => {
    if (!email || !password || !password2) return false;
    if (emailError || pwMatchError) return false;
    if (pwScore.score < 2) return false; // nudge to at least "Fair"
   
    return !loading;
  }, [email, password, password2, emailError, pwMatchError, pwScore.score, loading]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('role', role);
      form.append('email', email);
      form.append('password', password);
      form.append('first_name', firstName);
      form.append('last_name', lastName);
      if (phone) form.append('phone', phone);
      if (nicNumber) form.append('nic_number', nicNumber);
      if (role === 'Student') {
        if (guardianName) form.append('guardian_name', guardianName);
        if (guardianPhone) form.append('guardian_phone', guardianPhone);
        if (address) form.append('address', address);
      }
      if (photoFile) {
        try {
          form.append('profile_photo', photoFile);
          // base64 fallback for servers that miss file parts
          const b64 = await fileToDataURL(photoFile);
          if (b64) form.append('profile_photo_b64', b64);
        } catch {}
      }

      const { data } = await API.post('/auth/register', form);
      localStorage.setItem('auth', JSON.stringify(data));
      setUser(data.user);
      setToken(data.token);
      nav('/');
    } catch (e) {
      setErr(e.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card card-rounded" style={{maxWidth: 720}}>
        <div className="brand">
          <div className="brand-mark">DB</div>
          <div className="brand-meta">
            <h1 className="brand-title">Don Bosco</h1>
            <div className="brand-sub">Create your account</div>
          </div>
        </div>

        {err && <Alert severity="error" className="mb-3">{err}</Alert>}

        <form onSubmit={submit} className="grid-2 vstack-12">
          {/* Role */}
          <div className="form-floating-pro">
            <select
              className="form-select form-control-pro"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              disabled={!adminExists}
            >
              {!adminExists ? (
                <option>Admin</option>
              ) : (
                <>
                  <option>Student</option>
                  <option>Warden</option>
                </>
              )}
            </select>
            <label>Role</label>
          </div>

          {/* Name */}
          <div className="form-floating-pro">
            <input
              className="form-control form-control-pro"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <label>First Name</label>
          </div>
          <div className="form-floating-pro">
            <input
              className="form-control form-control-pro"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <label>Last Name</label>
          </div>

          {/* Contact */}
          <div className={`form-floating-pro ${emailError ? 'has-error' : ''}`}>
            <input
              type="email"
              className="form-control form-control-pro"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            <label>Email</label>
            {!!emailError && <div className="field-error">{emailError}</div>}
          </div>
          <div className="form-floating-pro">
            <input
              className="form-control form-control-pro"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
            />
            <label>Phone</label>
          </div>

          {/* NIC + Photo */}
          <div className="form-floating-pro">
            <input
              className="form-control form-control-pro"
              placeholder="NIC Number"
              value={nicNumber}
              onChange={(e) => setNicNumber(e.target.value)}
            />
            <label>NIC Number</label>
          </div>
          <div className="form-floating-pro">
            <input
              type="file"
              className="form-control form-control-pro"
              accept="image/*"
              name="profile_photo"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
            <label>Profile Photo</label>
          </div>

          {/* Passwords */}
          <div className="form-floating-pro pw-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              className="form-control form-control-pro"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <label>Password</label>
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw(s => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>

            {/* strength meter */}
            <div className={`pw-meter ${pwScore.className}`}>
              <div className="pw-meter-bar" style={{width: `${(pwScore.score+1) * 20}%`}} />
            </div>
            <div className="pw-hint">
              <strong>{pwScore.label}</strong>
              {pwScore.hint && <span className="muted"> — {pwScore.hint}</span>}
            </div>
          </div>

          <div className={`form-floating-pro pw-wrap ${pwMatchError ? 'has-error' : ''}`}>
            <input
              type={showPw2 ? 'text' : 'password'}
              className="form-control form-control-pro"
              placeholder="••••••••"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              autoComplete="new-password"
            />
            <label>Confirm Password</label>
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw2(s => !s)}
              aria-label={showPw2 ? 'Hide password' : 'Show password'}
            >
              {showPw2 ? 'Hide' : 'Show'}
            </button>
            {!!pwMatchError && <div className="field-error">{pwMatchError}</div>}
          </div>

          {/* Student-only fields */}
          {role === 'Student' && (
            <>
              <div className="form-floating-pro">
                <input
                  className="form-control form-control-pro"
                  placeholder="Guardian name"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
                <label>Guardian Name</label>
              </div>
              <div className="form-floating-pro">
                <input
                  className="form-control form-control-pro"
                  placeholder="Guardian phone"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  inputMode="tel"
                />
                <label>Guardian Phone</label>
              </div>
              <div className="form-floating-pro col-span-2">
                <input
                  className="form-control form-control-pro"
                  placeholder="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <label>Address</label>
              </div>
            </>
          )}

          {/* Agree + Submit */}
          <div className="col-span-2 actions-between">
            <button
              type="button"
              className="link-btn"
              onClick={() => nav('/login')}
            >
              Already have an account?
            </button>
          </div>

          <div className="col-span-2">
            <button className="btn btn-primary w-100 auth-btn" disabled={!canSubmit}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      <div className="auth-bg" aria-hidden="true">
        <div className="blob a" />
        <div className="blob b" />
      </div>
    </div>
  );
}

/* -------- helpers -------- */
function scorePassword(pw) {
  if (!pw) return { score: -1, label: 'Empty', className: 'none', hint: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  // normalize to 0..4
  score = Math.min(4, Math.max(0, score - 1));

  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  const hints  = [
    'Use 8+ chars with mix of upper/lower, numbers, symbols',
    'Add more length or variety',
    'Looks good—longer is stronger',
    'Great! Consider 12+ chars',
    'Great! Consider 12+ chars'
  ];
  const classes = ['weak', 'fair', 'good', 'strong', 'strong'];
  return { score, label: labels[score], hint: hints[score], className: classes[score] };
}

async function fileToDataURL(file) {
  if (!file) return '';
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read-error'));
    fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '');
    fr.readAsDataURL(file);
  });
}
