import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleBadge from './RoleBadge';
import '../styles/navbar.css';

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();

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
            {user ? (
              <>
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
