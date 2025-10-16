import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleBadge from './RoleBadge';
import NotificationBell from './NotificationBell';
import '../styles/navbar.css';

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState('');

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const stored = localStorage.getItem('theme');
    let next = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav className="navbar navbar-expand-lg sd-navbar">
      <div className="container">
        {/* Brand */}
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <span className="brand-dot"></span>
          <span className="fw-bold">Hostel Management System</span>
        </Link>

        {/* Collapse */}
        <div className="collapse navbar-collapse">
          {/* Left menu */}
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {user && user.role !== 'Student' && (
              <>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/students') ? 'active' : ''}`} to="/students">Students</Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/rooms') ? 'active' : ''}`} to="/rooms">Rooms</Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/fees') ? 'active' : ''}`} to="/fees">Fees</Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/attendance') ? 'active' : ''}`} to="/attendance">Attendance</Link>
                </li>
                <li className="nav-item">
                  <Link className={`nav-link ${isActive('/complaints') ? 'active' : ''}`} to="/complaints">Complaints</Link>
                </li>
                {user.role === 'Admin' && (
                  <>
                    <li className="nav-item">
                      <Link className={`nav-link ${isActive('/staff') ? 'active' : ''}`} to="/staff">Staff</Link>
                    </li>
                  </>
                )}
              </>
            )}

            {user && user.role === 'Student' && (
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/complaints') ? 'active' : ''}`} to="/complaints">Complaints</Link>
              </li>
            )}
          </ul>

          {/* Right menu */}
          <ul className="navbar-nav ms-auto align-items-center gap-2">
            <li className="nav-item">
              <button className="btn btn-outline-secondary btn-sm" onClick={toggleTheme} title={theme==='dark'?'Switch to light':'Switch to dark'}>
                {theme === 'dark' ? (
                  // sun icon
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.48 0l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 4V1h-0v3h0zm0 19v-3h0v3h0zM4 12H1v0h3v0zm19 0h-3v0h3v0zM6.76 19.16l-1.42 1.42-1.79-1.8 1.41-1.41 1.8 1.79zm10.48 0l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM12 8a4 4 0 100 8 4 4 0 000-8z"/>
                  </svg>
                ) : (
                  // moon icon
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                )}
              </button>
            </li>
            {user ? (
              <>
                <li className="nav-item d-none d-md-block">
                  <NotificationBell />
                </li>
                {(() => {
                  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');
                  const photo = user?.profile_photo ? API_ORIGIN + user.profile_photo : null;
                  return photo ? (
                    <li className="nav-item">
                      <img src={photo} alt="Profile" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    </li>
                  ) : null;
                })()}
                {(() => {
                  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
                  return (
                    <li className="nav-item d-none d-md-block">
                      <div className="d-flex flex-column lh-1 text-end">
                        <span className="fw-semibold" style={{ lineHeight: 1 }}>{name || user.email}</span>
                        <span className="text-muted small" style={{ lineHeight: 1 }}>{user.email}</span>
                      </div>
                    </li>
                  );
                })()}
                <li className="nav-item">
                  <RoleBadge role={user.role} />
                </li>
                <li className="nav-item">
                  <button className="btn btn-outline-danger btn-sm" onClick={logout}>Logout</button>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="btn btn-outline-primary btn-sm" to="/register">Register</Link>
                </li>
                <li className="nav-item">
                  <Link className="btn btn-primary btn-sm" to="/login">Login</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
