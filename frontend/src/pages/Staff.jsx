import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import Alert from '@mui/material/Alert';
import '../styles/staff.css';

const ROLES = ['Warden', 'Warden Assistant', 'Security', 'Maintenance', 'Cleaner'];

export default function Staff() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // create form (kept compatible with your API)
  const [name, setName] = useState('');
  const [role, setRole] = useState('Warden Assistant');
  const [phone, setPhone] = useState('');
  const [shift, setShift] = useState('');

  // inline edit
  const [editing, setEditing] = useState(null); // staff_id
  const [form, setForm] = useState({ name: '', role: '', phone: '', shift: '' });

  // filters/search
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const load = async () => {
    setBusy(true);
    try {
      const { data } = await API.get('/staff');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
      setErr('Failed to load staff');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      await API.post('/staff', { name, role, phone, shift });
      setMsg('Staff created');
      setName(''); setRole('Warden Assistant'); setPhone(''); setShift('');
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create staff');
    }
  };

  const startEdit = (row) => {
    setEditing(row.staff_id);
    setForm({ name: row.name, role: row.role, phone: row.phone || '', shift: row.shift || '' });
    setMsg(''); setErr('');
  };
  const saveEdit = async () => {
    setMsg(''); setErr('');
    try {
      await API.put(`/staff/${editing}`, form);
      setMsg('Staff updated');
      setEditing(null);
      load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to update');
    }
  };
  const cancelEdit = () => setEditing(null);
  const del = async (id) => {
    if (!confirm('Delete this staff member?')) return;
    setMsg(''); setErr('');
    try { await API.delete(`/staff/${id}`); setMsg('Staff deleted'); load(); }
    catch (e) { setErr(e.response?.data?.message || 'Failed to delete'); }
  };

  // derived: filters + KPIs
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      const roleOk = roleFilter === 'ALL' ? true : (r.role || '').toLowerCase() === roleFilter.toLowerCase();
      const hit = !term ||
        (r.name || '').toLowerCase().includes(term) ||
        (r.phone || '').toLowerCase().includes(term) ||
        (r.shift || '').toLowerCase().includes(term) ||
        (r.role || '').toLowerCase().includes(term);
      return roleOk && hit;
    });
  }, [rows, q, roleFilter]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const byRole = ROLES.reduce((m, r) => (m[r] = rows.filter(x => (x.role || '') === r).length, m), {});
    const uniqueShifts = new Set(rows.map(r => (r.shift || '').trim()).filter(Boolean)).size;
    return { total, byRole, uniqueShifts };
  }, [rows]);

  return (
    <div className="container py-4 staff-shell">
      <div className="page-head">
        <h4 className="mb-0">Staff</h4>
        <div className="chip chip-muted"><Dot /> {rows.length} total</div>
      </div>

      {(msg || err) && (
        <div className="mb-3">
          {msg && <Alert severity="success" className="mb-2">{msg}</Alert>}
          {err && <Alert severity="error" className="mb-2">{err}</Alert>}
        </div>
      )}

      {/* KPIs */}
      <section className="kpi-row">
        <KPI label="Total Staff" value={kpi.total} />
        <KPI label="Shifts (unique)" value={kpi.uniqueShifts} tone="info" />
        <KPI label="Wardens" value={kpi.byRole['Warden'] || 0} tone="primary" />
        <KPI label="Assistants" value={kpi.byRole['Warden Assistant'] || 0} tone="success" />
      </section>

      {/* Create */}
      <section className="card card-pro mb-3">
        <div className="card-head">
          <h6><Icon name="plus" /> Add Staff Member</h6>
          <p className="muted small">Add core details; you can edit later anytime.</p>
        </div>
        <form onSubmit={submit} className="grid-4 vstack-12">
          <div className="form-floating-pro col-span-2">
            <input className="form-control form-control-pro" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
            <label>Full name</label>
          </div>
          <div className="form-floating-pro">
            <input list="roles" className="form-control form-control-pro" placeholder="Role" value={role} onChange={e => setRole(e.target.value)} />
            <label>Role</label>
            <datalist id="roles">{ROLES.map(r => <option key={r} value={r} />)}</datalist>
          </div>
          <div className="form-floating-pro">
            <input className="form-control form-control-pro" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
            <label>Phone</label>
          </div>
          <div className="form-floating-pro">
            <input className="form-control form-control-pro" placeholder="Shift (e.g., Day/Night)" value={shift} onChange={e => setShift(e.target.value)} />
            <label>Shift</label>
          </div>
          <div className="col-span-4">
            <button className="btn btn-primary w-100"><Icon name="save" /> Create</button>
          </div>
        </form>
      </section>

      {/* Toolbar */}
      <section className="card card-pro toolbar">
        <div className="toolbar-row">
          <div className="search-wrap">
            <Icon name="search" />
            <input
              className="search-input"
              placeholder="Search name, phone, shift or role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="segmented">
            {['ALL', ...ROLES].map(r => (
              <button
                key={r}
                type="button"
                className={`seg-btn ${roleFilter === r ? 'active' : ''}`}
                onClick={() => setRoleFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="card card-pro">
        <div className="card-head head-inline">
          <h6><Icon name="users" /> Team</h6>
          <div className="chipset">
            <span className="chip">{filtered.length} shown</span>
          </div>
        </div>

        {busy ? (
          <div className="skeleton-wrap">
            <div className="skeleton skeleton-bar" />
            <div className="skeleton skeleton-table" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-wrap">
            <div className="empty-emoji">👥</div>
            <h5>No staff found</h5>
            <p className="muted">Try another role or clear the search.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 44 }}></th>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Shift</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isEd = editing === s.staff_id;
                  const initials = getInitials(s.name || '');
                  const hue = hashToHue(s.name || String(s.staff_id));
                  return (
                    <tr key={s.staff_id} className="row-hover">
                      <td>
                        <div className="avatar" style={{ background: `hsl(${hue} 70% 45%)` }}>{initials}</div>
                      </td>
                      <td>{s.staff_id}</td>
                      <td>
                        {isEd
                          ? <input className="form-control form-control-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                          : <strong>{s.name}</strong>}
                      </td>
                      <td>
                        {isEd
                          ? <input list="roles" className="form-control form-control-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                          : s.role}
                      </td>
                      <td>
                        {isEd
                          ? <input className="form-control form-control-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                          : (s.phone || '-')}
                      </td>
                      <td>
                        {isEd
                          ? <input className="form-control form-control-sm" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} />
                          : (s.shift || '-')}
                      </td>
                      <td className="text-end">
                        {isEd ? (
                          <>
                            <button className="btn btn-sm btn-success me-2" onClick={saveEdit}><Icon name="check" /> Save</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={cancelEdit}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(s)}><Icon name="edit" /> Edit</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => del(s.staff_id)}><Icon name="trash" /> Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* -------- UI bits -------- */

function KPI({ label, value, tone = 'default' }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function Dot() { return <span className="dot" aria-hidden="true" />; }

function Icon({ name }) {
  switch (name) {
    case 'plus': return <svg className="icon" viewBox="0 0 24 24"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>;
    case 'save': return <svg className="icon" viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/></svg>;
    case 'search': return <svg className="icon" viewBox="0 0 24 24"><path d="M10 18a8 8 0 1 1 6.32-3.09l4.39 4.39-1.42 1.42-4.39-4.39A8 8 0 0 1 10 18Z"/></svg>;
    case 'users': return <svg className="icon" viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9 9a7 7 0 0 1 14 0H7Zm1-9a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-6 9a5 5 0 0 1 10 0H2Z"/></svg>;
    case 'check': return <svg className="icon" viewBox="0 0 24 24"><path d="m9 16.17-3.88-3.88L4 13.41 9 18.41 20.59 6.83 19.17 5.41 9 16.17Z"/></svg>;
    case 'edit': return <svg className="icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM21 5.75a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15 3.59l3.75 3.75L21 5.75Z"/></svg>;
    case 'trash': return <svg className="icon" viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7L6 7Zm2-3h8l1 2H7l1-2Z"/></svg>;
    default: return null;
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
  let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
