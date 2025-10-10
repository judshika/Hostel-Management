import React, { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/auth.css';

export default function Login() {
  const [email, setEmail] = useState(''); // avoid hardcoding credentials
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const { login } = useAuth();

  const emailError = useMemo(() => {
    if (!email) return '';
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return ok ? '' : 'Enter a valid email address';
  }, [email]);

  const canSubmit = email && password && !emailError && !loading;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErr('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      nav('/');
    } catch (e) {
      setErr(e.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card card-rounded">
        {/* Brand / Logo slot (optional) */}
        <div className="brand">
          <div className="brand-mark">TA</div>
          <div className="brand-meta">
            <h1 className="brand-title">Twite AI</h1>
            {/* <div className="brand-sub">Hostel Admin</div> */}
          </div>
        </div>

       <h4 style={{ textAlign: "center" }}>Welcomback</h4>
        <p className="muted mb-3">Sign in to continue</p>

        {err && <Alert severity="error" className="mb-3">{err}</Alert>}

        <form onSubmit={submit} className="vstack-12">
          {/* Email */}
          <div className={`form-floating-pro ${emailError ? 'has-error' : ''}`}>
            <input
              className="form-control form-control-pro"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />

            <label>Email</label>
            {!!emailError && <div className="field-error">{emailError}</div>}
          </div>
<br/>
          {/* Password */}
          <div className="form-floating-pro pw-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              className="form-control form-control-pro"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <label>Password</label>
            <button
              type="button"
              className="pw-toggle"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw((s) => !s)}
              tabIndex={0}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
<br/>
          <div className="actions">
            <label className="remember">
              <input type="checkbox" /> <span>Remember me</span>
            </label>
            {/* <button
              type="button"
              className="link-btn"
              onClick={() => nav('/forgot-password')}
            >
              Forgot password?
            </button> */}
          </div>
<br/>
          <button className="btn btn-primary w-100 auth-btn" disabled={!canSubmit}>
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <div className="foot-note">
          <span className="muted">By continuing, you agree to our</span>{' '}
          <button type="button" className="link-btn">Terms</button>
          <span className="muted"> and </span>
          <button type="button" className="link-btn">Privacy Policy</button>
        </div>
      </div>

      {/* Optional background illustration */}
      <div className="auth-bg" aria-hidden="true">
        <div className="blob a" />
        <div className="blob b" />
      </div>
    </div>
  );
}
