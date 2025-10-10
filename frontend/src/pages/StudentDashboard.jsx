import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import PageHeader from '../components/PageHeader';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import '../styles/student-dashboard.css';
import '../styles/attendance.css';
import '../styles/students-cards.css';

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [edit, setEdit] = useState({
    student_id: null,
    first_name: '',
    last_name: '',
    phone: '',
    nic_number: '',
    guardian_name: '',
    guardian_phone: '',
    address: ''
  });

  // Attendance (view only)
  const [attMonth, setAttMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [attView, setAttView] = useState(null); // { ym, present, absent, rate }
  const [attErr, setAttErr] = useState('');
  const [attBusy, setAttBusy] = useState(false);

  // Payments
  const [paying, setPaying] = useState(null); // bill id
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payErr, setPayErr] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: me }, { data: my }] = await Promise.all([
          API.get('/students/me'),
          API.get('/fees/my')
        ]);
        setProfile(me);
        setBills(my || []);
      } catch (e) {
        setErr(e.response?.data?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const dueMap = useMemo(() => {
    const m = {};
    bills.forEach(b => { m[b.bill_id] = parseFloat(b.total); });
    return m;
  }, [bills]);

  // Helpers
  const money = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0.00';
    return num.toFixed(2);
  };

  const formatMonth = (m) => {
    // Accept "2025-09" or any backend string; fallback to raw
    if (/^\d{4}-\d{2}$/.test(m)) {
      const [y, mm] = m.split('-');
      const date = new Date(Number(y), Number(mm) - 1, 1);
      return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }
    return m;
  };

  const statusBadgeClass = (status) => {
    if (status === 'PAID') return 'sd-badge sd-badge--paid';
    if (status === 'PARTIAL') return 'sd-badge sd-badge--partial';
    return 'sd-badge sd-badge--due';
  };

  const startPay = (bill) => {
    setPaying(bill.bill_id);
    setPayAmount(String(bill.total));
    setPayMethod('Cash');
    setPayRef('');
    setPayErr('');
  };

  const openEdit = () => {
    if (!profile?.student) return;
    const s = profile.student;
    setEdit({
      student_id: s.student_id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      phone: s.phone || '',
      nic_number: s.nic_number || '',
      guardian_name: s.guardian_name || '',
      guardian_phone: s.guardian_phone || '',
      address: s.address || ''
    });
    setEditErr('');
    setEditBusy(false);
    setEditOpen(true);
  };

  const [editPhoto, setEditPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    if (editOpen) {
      const API_ORIGIN = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');
      const current = profile?.student?.profile_photo ? API_ORIGIN + profile.student.profile_photo : '';
      setPhotoPreview(current);
      setEditPhoto(null);
    }
  }, [editOpen]);

  const onSelectPhoto = (file) => {
    if (!file) { setEditPhoto(null); return; }
    setEditPhoto(file);
    const r = new FileReader();
    r.onload = () => setPhotoPreview(r.result);
    r.readAsDataURL(file);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!edit.student_id) return;
    setEditBusy(true); setEditErr('');
    try {
      if (editPhoto) {
        const fd = new FormData();
        fd.append('photo', editPhoto);
        // Fallback: also send base64 data URL so backend can accept either
        if (photoPreview && typeof photoPreview === 'string' && photoPreview.startsWith('data:image/')) {
          fd.append('photo_data', photoPreview);
        }
        const { data: up } = await API.post('/auth/profile-photo', fd);
        if (up?.profile_photo) {
          setProfile((prev) => prev ? { ...prev, student: { ...prev.student, profile_photo: up.profile_photo } } : prev);
        }
      }
      await API.put(`/students/${edit.student_id}`, {
        first_name: edit.first_name?.trim() || null,
        last_name: edit.last_name?.trim() || null,
        phone: edit.phone?.trim() || null,
        nic_number: edit.nic_number?.trim() || null,
        guardian_name: edit.guardian_name?.trim() || null,
        guardian_phone: edit.guardian_phone?.trim() || null,
        address: edit.address?.trim() || null
      });
      // sync local profile
      setProfile((prev) => prev ? {
        ...prev,
        student: {
          ...prev.student,
          first_name: edit.first_name,
          last_name: edit.last_name,
          phone: edit.phone,
          nic_number: edit.nic_number,
          guardian_name: edit.guardian_name,
          guardian_phone: edit.guardian_phone,
          address: edit.address
        }
      } : prev);
      setEditOpen(false);
    } catch (e2) {
      setEditErr(e2.response?.data?.message || 'Failed to update');
    } finally {
      setEditBusy(false);
    }
  };

  const cancelPay = () => {
    setPaying(null);
    setPayAmount('');
    setPayMethod('Cash');
    setPayRef('');
    setPayErr('');
    setPaySubmitting(false);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    setPayErr('');

    const parsed = parseFloat(payAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPayErr('Enter a valid amount greater than 0');
      return;
    }

    setPaySubmitting(true);
    try {
      await API.post('/fees/pay', {
        bill_id: paying,
        method: payMethod,
        reference: payRef?.trim() || null,
        amount: parsed
      });
      const { data: my } = await API.get('/fees/my');
      setBills(my || []);
      cancelPay();
    } catch (e2) {
      setPayErr(e2.response?.data?.message || 'Payment failed');
    } finally {
      setPaySubmitting(false);
    }
  };

  const loadMyAttendance = async (month) => {
    setAttErr('');
    setAttBusy(true);
    try {
      const { data } = await API.get('/attendance/summary', { params: { month } });
      const row = Array.isArray(data) && data.length ? data[0] : null;
      if (row) {
        const present = Number(row.present || 0);
        const absent = Number(row.absent || 0);
        const total = present + absent;
        setAttView({ ym: row.ym, present, absent, rate: total > 0 ? present / total : 0 });
      } else {
        setAttView({ ym: month, present: 0, absent: 0, rate: 0 });
      }
    } catch (e2) {
      setAttErr(e2.response?.data?.message || 'Failed to load attendance');
      setAttView(null);
    } finally {
      setAttBusy(false);
    }
  };

  useEffect(() => { loadMyAttendance(attMonth); }, [attMonth]);

  if (loading) {
    return (
      <div className="container py-4">
        <div className="sd-skeleton stack-16">
          <div className="sd-skel-card" />
          <div className="sd-skel-card" />
          <div className="sd-skel-table" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="container py-4">
        <Alert severity="error">{err}</Alert>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Student Dashboard"
        subtitle="Your details, room and payments"
        variant="Student"
      />

      <div className="container py-4 sd-page">
        {/* Top: profile + allocation */}
        {profile && (
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <div className="card sd-card">
                <div className="card-header sd-card__header d-flex align-items-center justify-content-between">
                  <div className="sd-card__title">My Details</div>
                  <button className="btn btn-sm btn-outline-primary" onClick={openEdit}>Edit</button>
                </div>
                <div className="card-body sd-card__body">
                  {(() => {
                    const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');
                    const photo = profile.student.profile_photo ? API_ORIGIN + profile.student.profile_photo : null;
                    return (
                      <div className="d-flex align-items-center gap-3 mb-3">
                        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#eee', flex: '0 0 auto' }}>
                          {photo ? (
                            <img src={photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No Photo</div>
                          )}
                        </div>
                        <div>
                          <div className="fw-semibold">{profile.student.first_name} {profile.student.last_name}</div>
                          <div className="text-muted">{profile.student.email}</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="sd-field"><span className="sd-label">Name</span><span className="sd-value">{profile.student.first_name} {profile.student.last_name}</span></div>
                  <div className="sd-field"><span className="sd-label">Email</span><span className="sd-value">{profile.student.email}</span></div>
                  <div className="sd-field"><span className="sd-label">Phone</span><span className="sd-value">{profile.student.phone || '-'}</span></div>
                  <div className="sd-field"><span className="sd-label">NIC Number</span><span className="sd-value">{profile.student.nic_number || '-'}</span></div>
                  <div className="sd-field">
                    <span className="sd-label">Guardian</span>
                    <span className="sd-value">
                      {profile.student.guardian_name || '-'}{profile.student.guardian_phone ? ` (${profile.student.guardian_phone})` : ''}
                    </span>
                  </div>
                  <div className="sd-field"><span className="sd-label">Address</span><span className="sd-value">{profile.student.address || '-'}</span></div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card sd-card">
                <div className="card-header sd-card__header">
                  <div className="sd-card__title">Room Allocation</div>
                </div>
                <div className="card-body sd-card__body">
                  {profile.allocation ? (
                    <>
                      <div className="sd-field"><span className="sd-label">Block/Floor</span><span className="sd-value">{profile.allocation.block}-{profile.allocation.floor}</span></div>
                      <div className="sd-field"><span className="sd-label">Room</span><span className="sd-value">#{profile.allocation.room_number}</span></div>
                      <div className="sd-field"><span className="sd-label">From</span><span className="sd-value">{profile.allocation.start_date}</span></div>
                    </>
                  ) : (
                    <div className="sd-empty">Not allocated</div>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance (view only) */}
            <div className="col-12">
              <div className="card sd-card">
                <div className="card-header sd-card__header">
                  <div className="sd-card__title">My Attendance</div>
                </div>
                <div className="card-body sd-card__body">
                  {attErr && <Alert severity="error" className="mb-3">{attErr}</Alert>}
                  <div className="row g-3 align-items-end mb-2">
                    <div className="col-md-4">
                      <label className="form-label">Month</label>
                      <input
                        type="month"
                        className="form-control"
                        value={attMonth}
                        onChange={e => setAttMonth(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label d-block">&nbsp;</label>
                      <button className="btn btn-outline-secondary" onClick={() => loadMyAttendance(attMonth)} disabled={attBusy}>
                        Refresh
                      </button>
                    </div>
                  </div>

                  {attBusy ? (
                    <div className="sd-empty">Loading…</div>
                  ) : attView ? (
                    <div className="row g-3">
                      <div className="col-md-4">
                        <div className="sd-field"><span className="sd-label">Month</span><span className="sd-value">{formatMonth(attView.ym)}</span></div>
                      </div>
                      <div className="col-md-4">
                        <div className="sd-field"><span className="sd-label">Present</span><span className="sd-value">{attView.present}</span></div>
                      </div>
                      <div className="col-md-4">
                        <div className="sd-field"><span className="sd-label">Absent</span><span className="sd-value">{attView.absent}</span></div>
                      </div>
                      <div className="col-12">
                        <Bar ratio={attView.rate} present={attView.present} absent={attView.absent} />
                      </div>
                    </div>
                  ) : (
                    <div className="sd-empty">No data</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bills */}
        <div className="card sd-card">
          <div className="card-header sd-card__header">
            <div>
              <div className="sd-card__title">Monthly Fees</div>
              <div className="sd-card__subtitle">Track your hostel fee status and pay dues</div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table mb-0 sd-table">
              <thead className="table-light">
                <tr>
                  <th>Month</th>
                  <th className="text-end">Total (Rs.)</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="sd-empty py-4">No bills found</div>
                    </td>
                  </tr>
                ) : bills.map(b => (
                  <tr key={b.bill_id} className="sd-row">
                    <td>{formatMonth(b.month_year)}</td>
                    <td className="text-end">{money(b.total)}</td>
                    <td><span className={statusBadgeClass(b.status)}>{b.status}</span></td>
                    <td className="text-end">
                      {b.status !== 'PAID' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => startPay(b)}
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Panel */}
        {paying && (
          <div className="card sd-card mt-3">
            <div className="card-header sd-card__header">
              <div className="sd-card__title">Make Payment</div>
            </div>
            <div className="card-body sd-card__body">
              {payErr && <Alert severity="error" className="mb-3">{payErr}</Alert>}

              <form onSubmit={submitPay} className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Amount</label>
                  <input
                    className="form-control"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Method</label>
                  <select
                    className="form-select"
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                  >
                    <option>Cash</option>
                    <option>Card</option>
                    <option>UPI</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Reference</label>
                  <input
                    className="form-control"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    placeholder="Txn ID / Notes"
                  />
                </div>

                <div className="col-12 d-flex gap-2">
                  <button className="btn btn-success" disabled={paySubmitting}>
                    {paySubmitting ? 'Submitting…' : 'Submit Payment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={cancelPay}
                    disabled={paySubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit My Details</DialogTitle>
        <DialogContent dividers>
          {editErr && <Alert severity="error" className="mb-3">{editErr}</Alert>}
          <div className="d-flex align-items-center gap-3 mb-3">
            <Avatar src={photoPreview || undefined} sx={{ width: 64, height: 64 }} />
            <div>
              <input id="photo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e)=>onSelectPhoto(e.target.files?.[0])} />
              <label htmlFor="photo-input">
                <Button variant="outlined" component="span" size="small">Change Photo</Button>
              </label>
            </div>
          </div>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField label="First Name" fullWidth value={edit.first_name} onChange={e=>setEdit(s=>({...s, first_name: e.target.value}))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Last Name" fullWidth value={edit.last_name} onChange={e=>setEdit(s=>({...s, last_name: e.target.value}))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Phone" fullWidth value={edit.phone} onChange={e=>setEdit(s=>({...s, phone: e.target.value}))} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="NIC Number" fullWidth value={edit.nic_number} onChange={e=>setEdit(s=>({...s, nic_number: e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Guardian Name" fullWidth value={edit.guardian_name} onChange={e=>setEdit(s=>({...s, guardian_name: e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Guardian Phone" fullWidth value={edit.guardian_phone} onChange={e=>setEdit(s=>({...s, guardian_phone: e.target.value}))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" fullWidth multiline minRows={3} value={edit.address} onChange={e=>setEdit(s=>({...s, address: e.target.value}))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setEditOpen(false)} disabled={editBusy}>Cancel</Button>
          <Button onClick={submitEdit} variant="contained" disabled={editBusy}>{editBusy ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// removed custom modal in favor of MUI Dialog

// Simple attendance bar (reuse styles from attendance.css)
function Bar({ ratio, present, absent }) {
  const pct = Math.round((ratio || 0) * 100);
  const pW = Math.max(0, Math.min(100, pct));
  const aW = 100 - pW;
  return (
    <div className="bar">
      <div className="bar-p" style={{ width: `${pW}%` }} />
      <div className="bar-a" style={{ width: `${aW}%` }} />
      <div className="bar-label">{pct}%</div>
    </div>
  );
}
