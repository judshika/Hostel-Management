import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import PageHeader from '../components/PageHeader';
import '../styles/students-cards.css';
import { useAuth } from '../context/AuthContext';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Grid } from '@mui/material';

export default function StudentsCardView() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null); // student object
  const [editing, setEditing] = useState(null); // form state
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(null);
  const { user } = useAuth() || {};

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    API.get('/students')
      .then(r => { if (mounted) setRows(r.data || []); })
      .catch(() => { if (mounted) setRows([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => {
      const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase();
      return (
        name.includes(term) ||
        (r.email ?? '').toLowerCase().includes(term) ||
        (r.phone ?? '').toLowerCase().includes(term) ||
        (r.guardian_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [rows, q]);

  function exportCSV() {
    const headers = [
      'Student ID', 'First Name', 'Last Name', 'Email', 'Phone', 'NIC',
      'Guardian Name', 'Guardian Phone', 'Address'
    ];
    const lines = [headers.join(',')];
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    (filtered || rows || []).forEach(r => {
      const row = [
        r.student_id,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.nic_number,
        r.guardian_name,
        r.guardian_phone,
        r.address,
      ].map(esc).join(',');
      lines.push(row);
    });
    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
    a.href = url;
    a.download = `students-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Students" subtitle="Directory of enrolled students" />

      <div className="container py-4">
        {/* Toolbar */}
        <div className="students-toolbar">
          <div className="search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 18a8 8 0 1 1 6.32-3.09l4.39 4.39-1.42 1.42-4.39-4.39A8 8 0 0 1 10 18Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" fill="currentColor"/></svg>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              className="search-input"
              placeholder="Search by name, email, phone, guardian…"
            />
          </div>

          <div className="toolbar-right">
            {user?.role === 'Admin' && (
              <button
                type="button"
                className="btn btn-sm btn-primary me-2"
                onClick={() => setCreating({
                  email: '', password: '', first_name: '', last_name: '', phone: '', nic_number: '',
                  guardian_name: '', guardian_phone: '', address: ''
                })}
              >
                Add Student
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={exportCSV}>
              Export CSV
            </button>
            <span className="muted">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Loading / Empty states */}
        {loading ? (
          <div className="empty-wrap">
            <div className="spinner" />
            <p className="muted">Loading students…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-wrap">
            <div className="empty-illustration">🙂</div>
            <h4>No students found</h4>
            <p className="muted">Try adjusting your search or check back later.</p>
          </div>
        ) : (
          <div className="students-grid">
            {filtered.map(r => (
              <StudentCard
                key={r.student_id}
                data={r}
                onView={() => setViewing(r)}
                onEdit={() => setEditing({
                  student_id: r.student_id,
                  first_name: r.first_name || '',
                  last_name: r.last_name || '',
                  phone: r.phone || '',
                  nic_number: r.nic_number || '',
                  guardian_name: r.guardian_name || '',
                  guardian_phone: r.guardian_phone || '',
                  address: r.address || ''
                })}
                onDelete={async () => {
                  if (!window.confirm('Delete this student? This cannot be undone.')) return;
                  setBusy(true); setErr('');
                  try {
                    await API.delete(`/students/${r.student_id}`);
                    setRows(prev => prev.filter(x => x.student_id !== r.student_id));
                  } catch (e) {
                    setErr(e.response?.data?.message || 'Failed to delete');
                  } finally { setBusy(false); }
                }}
              />
            ))}
          </div>
        )}

        {/* Error toast */}
        {err && (
          <div className="alert alert-danger mt-3" role="alert">{err}</div>
        )}

        {/* View dialog (MUI) */}
        <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} fullWidth maxWidth="sm">
          <DialogTitle>Student Details</DialogTitle>
          <DialogContent dividers>
            <div className="vstack gap-2">
              {(() => {
                const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');
                const photo = viewing?.profile_photo ? API_ORIGIN + viewing.profile_photo : null;
                return photo ? (
                  <div className="mb-2 d-flex justify-content-center">
                    <img src={photo} alt="Profile" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
                  </div>
                ) : null;
              })()}
              <Field label="Name" value={`${viewing?.first_name || ''} ${viewing?.last_name || ''}`.trim() || '-'} />
              <Field label="Email" value={viewing?.email || '-'} />
              <Field label="Phone" value={viewing?.phone || '-'} />
              <Field label="NIC" value={viewing?.nic_number || '-'} />
              <Field label="Guardian" value={viewing?.guardian_name ? `${viewing.guardian_name}${viewing?.guardian_phone ? ` (${viewing.guardian_phone})` : ''}` : '-'} />
              <Field label="Address" value={formatAddress(viewing || {})} />
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewing(null)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Create dialog (MUI) */}
        <Dialog open={Boolean(creating && user?.role === 'Admin')} onClose={() => setCreating(null)} fullWidth maxWidth="sm">
          <DialogTitle>Add Student</DialogTitle>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setErr('');
              try {
                const payload = {
                  email: creating?.email?.trim(),
                  password: creating?.password?.trim() || undefined,
                  first_name: creating?.first_name?.trim() || null,
                  last_name: creating?.last_name?.trim() || null,
                  phone: creating?.phone?.trim() || null,
                  nic_number: creating?.nic_number?.trim() || null,
                  guardian_name: creating?.guardian_name?.trim() || null,
                  guardian_phone: creating?.guardian_phone?.trim() || null,
                  address: creating?.address?.trim() || null,
                };
                const { data } = await API.post('/students', payload);
                const created = data?.student || data;
                setRows(prev => [created, ...prev]);
                if (data?.generated_password) {
                  window.alert(`Student created. Temporary password: ${data.generated_password}`);
                }
                setCreating(null);
              } catch (e2) {
                setErr(e2.response?.data?.message || 'Failed to create student');
              } finally { setBusy(false); }
            }}
          >
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="First Name" fullWidth size="small" value={creating?.first_name || ''}
                    onChange={e => setCreating(s => ({ ...s, first_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Last Name" fullWidth size="small" value={creating?.last_name || ''}
                    onChange={e => setCreating(s => ({ ...s, last_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField type="email" required label="Email" fullWidth size="small" value={creating?.email || ''}
                    onChange={e => setCreating(s => ({ ...s, email: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Password (optional)" helperText="Leave blank to auto-generate" fullWidth size="small" value={creating?.password || ''}
                    onChange={e => setCreating(s => ({ ...s, password: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Phone" fullWidth size="small" value={creating?.phone || ''}
                    onChange={e => setCreating(s => ({ ...s, phone: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="NIC" fullWidth size="small" value={creating?.nic_number || ''}
                    onChange={e => setCreating(s => ({ ...s, nic_number: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Guardian Name" fullWidth size="small" value={creating?.guardian_name || ''}
                    onChange={e => setCreating(s => ({ ...s, guardian_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Guardian Phone" fullWidth size="small" value={creating?.guardian_phone || ''}
                    onChange={e => setCreating(s => ({ ...s, guardian_phone: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Address" fullWidth size="small" multiline minRows={3} value={creating?.address || ''}
                    onChange={e => setCreating(s => ({ ...s, address: e.target.value }))} />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreating(null)} disabled={busy}>Cancel</Button>
              <Button variant="contained" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create'}</Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Edit dialog (MUI) */}
        <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>Edit Student</DialogTitle>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true); setErr('');
              try {
                await API.put(`/students/${editing.student_id}` , {
                  first_name: editing?.first_name?.trim() || null,
                  last_name: editing?.last_name?.trim() || null,
                  phone: editing?.phone?.trim() || null,
                  nic_number: editing?.nic_number?.trim() || null,
                  guardian_name: editing?.guardian_name?.trim() || null,
                  guardian_phone: editing?.guardian_phone?.trim() || null,
                  address: editing?.address?.trim() || null,
                });
                // sync into rows
                setRows(prev => prev.map(x => x.student_id === editing.student_id ? {
                  ...x,
                  first_name: editing.first_name,
                  last_name: editing.last_name,
                  phone: editing.phone,
                  nic_number: editing.nic_number,
                  guardian_name: editing.guardian_name,
                  guardian_phone: editing.guardian_phone,
                  address: editing.address,
                } : x));
                setEditing(null);
              } catch (e2) {
                setErr(e2.response?.data?.message || 'Failed to update');
              } finally { setBusy(false); }
            }}
          >
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="First Name" fullWidth size="small" value={editing?.first_name || ''}
                    onChange={e => setEditing(s => ({ ...s, first_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Last Name" fullWidth size="small" value={editing?.last_name || ''}
                    onChange={e => setEditing(s => ({ ...s, last_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Phone" fullWidth size="small" value={editing?.phone || ''}
                    onChange={e => setEditing(s => ({ ...s, phone: e.target.value }))} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="NIC" fullWidth size="small" value={editing?.nic_number || ''}
                    onChange={e => setEditing(s => ({ ...s, nic_number: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Guardian Name" fullWidth size="small" value={editing?.guardian_name || ''}
                    onChange={e => setEditing(s => ({ ...s, guardian_name: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Guardian Phone" fullWidth size="small" value={editing?.guardian_phone || ''}
                    onChange={e => setEditing(s => ({ ...s, guardian_phone: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Address" fullWidth size="small" multiline minRows={3} value={editing?.address || ''}
                    onChange={e => setEditing(s => ({ ...s, address: e.target.value }))} />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
              <Button variant="contained" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
            </DialogActions>
          </form>
        </Dialog>
      </div>
    </>
  );
}

function StudentCard({ data, onView, onEdit, onDelete }) {
  const {
    first_name, last_name, email, phone,
    guardian_name, guardian_phone, address, city, state, zip
  } = data || {};

  const name = `${first_name ?? ''} ${last_name ?? ''}`.trim() || 'Unnamed';
  const initials = getInitials(name);
  const hue = hashToHue(name);

  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '');
  const photo = data?.profile_photo ? API_ORIGIN + data.profile_photo : null;

  return (
    <div className="student-card card-elev">
      <div className="card-top">
        {photo ? (
          <img className="avatar" src={photo} alt={name} style={{ objectFit: 'cover' }} />
        ) : (
          <div className="avatar" style={{ background: `hsl(${hue} 70% 45%)` }}>
            {initials}
          </div>
        )}
        <div className="title-wrap">
          <h5 className="title">{name}</h5>
          {email ? <div className="sub">{email}</div> : <div className="sub muted">No email</div>}
        </div>
      </div>

      <div className="card-body">
        <InfoRow icon="phone" label="Phone" value={phone} />
        <InfoRow icon="id" label="NIC" value={data?.nic_number} />
        <InfoRow icon="guardian" label="Guardian" value={
          guardian_name ? `${guardian_name}${guardian_phone ? ` (${guardian_phone})` : ''}` : '-'
        } />
        <InfoRow
          icon="address"
          label="Address"
          value={formatAddress({ address, city, state, zip })}
          clamp
        />
      </div>

      <div className="card-actions">
        <button className="btn-ghost" type="button" onClick={onView}>
          <InlineIcon name="eye" /> View
        </button>
        <button className="btn-ghost" type="button" onClick={onEdit}>
          <InlineIcon name="edit" /> Edit
        </button>
        <button className="btn-ghost danger" type="button" onClick={onDelete}>
          <InlineIcon name="trash" /> Delete
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, clamp = false }) {
  return (
    <div className={`info-row ${clamp ? 'clamp-2' : ''}`}>
      <InlineIcon name={icon} />
      <div className="info-content">
        <span className="info-label">{label}</span>
        <span className="info-value">{value || '-'}</span>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-uppercase small text-muted">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function InlineIcon({ name }) {
  // Minimal inline icons (no external deps)
  switch (name) {
    case 'phone':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M6.62 10.79a15.11 15.11 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.56.57 1 1 0 0 1 1 1v3.59a1 1 0 0 1-1 1A17 17 0 0 1 3 5a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.56 1 1 0 0 1-.24 1.01l-2.3 2.22Z"/></svg>;
    case 'guardian':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-9 9a9 9 0 0 1 18 0H3Z"/></svg>;
    case 'address':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"/></svg>;
    case 'id':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 5h18v14H3V5Zm2 2v10h14V7H5Zm2 2h6v2H7V9Zm0 4h10v2H7v-2Z"/></svg>;
    case 'eye':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 11a4 4 0 1 1 4-4 4 4 0 0 1-4 4Z"/></svg>;
    case 'edit':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15 3.59l3.75 3.75L21 5.75Z"/></svg>;
    case 'trash':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm2-3h8l1 2H7l1-2Z"/></svg>;
    default:
      return null;
  }
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('');
}

function hashToHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

function formatAddress({ address, city, state, zip }) {
  return [address, city, state, zip].filter(Boolean).join(', ') || '-';
}
