import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Alert from '@mui/material/Alert';
import '../styles/complaints.css';

export default function Complaints() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // student form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // admin/warden inline edit state
  const [edit, setEdit] = useState({}); // { [id]: { status, assigned_to_staff_id } }
  const [staff, setStaff] = useState([]);

  // filters
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL|Pending|In Progress|Resolved
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    setMsg(''); setErr('');
    try {
      const { data } = await API.get('/complaints');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to load complaints');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (user && user.role !== 'Student') {
      API.get('/staff')
        .then(r => setStaff(r.data || []))
        .catch(() => setStaff([]));
    }
  }, [user]);

  const submitComplaint = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      await API.post('/complaints', { title, description, photo_url: photoUrl || undefined });
      setMsg('Complaint submitted');
      setTitle(''); setDescription(''); setPhotoUrl('');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to submit');
    } finally {
      load();
    }
  };

  const updateStatus = async (id) => {
    const payload = edit[id];
    if (!payload) return;
    setMsg(''); setErr('');
    try {
      await API.put(`/complaints/${id}/status`, payload);
      setMsg('Complaint updated');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to update');
    } finally {
      load();
    }
  };

  const isAdmin = user?.role !== 'Student';

  // Derived: KPI + filtered rows
  const kpi = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(r => r.status === 'Pending').length;
    const inprog = rows.filter(r => r.status === 'In Progress').length;
    const resolved = rows.filter(r => r.status === 'Resolved').length;
    return { total, pending, inprog, resolved };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      const statusOk = statusFilter === 'ALL' ? true : r.status === statusFilter;
      const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase();
      const hit = !term || name.includes(term) || (r.title ?? '').toLowerCase().includes(term);
      return statusOk && hit;
    });
  }, [rows, statusFilter, q]);

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle="Report issues and track resolutions"
        extra={
          <span className="chip chip-muted">
            <InlineDot /> {kpi.total} total
          </span>
        }
      />

      <div className="container py-4 complaints-shell">
        {(msg || err) && (
          <div className="mb-3">
            {msg && <Alert severity="success" className="mb-2">{msg}</Alert>}
            {err && <Alert severity="error" className="mb-2">{err}</Alert>}
          </div>
        )}

        {/* KPIs */}
        <section className="kpi-row">
          <Kpi label="Total" value={kpi.total} />
          <Kpi label="Pending" value={kpi.pending} tone="warning" />
          <Kpi label="In Progress" value={kpi.inprog} tone="info" />
          <Kpi label="Resolved" value={kpi.resolved} tone="success" />
        </section>

        {/* Student: Report Complaint */}
        {user?.role === 'Student' && (
          <section className="card card-pro mb-3">
            <div className="card-head">
              <h6><Icon name="report" /> Report a Complaint</h6>
              <p className="muted small">Provide a clear title and description. A photo URL helps speed up resolution.</p>
            </div>
            <form onSubmit={submitComplaint} className="grid-2 vstack-12">
              <div className="form-floating-pro">
                <input
                  className="form-control form-control-pro"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="Title"
                />
                <label>Title</label>
              </div>
              {/* <div className="form-floating-pro">
                <input
                  className="form-control form-control-pro"
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="https://…"
                />
                <label>Photo URL (optional)</label>
              </div> */}
              <div className="form-floating-pro col-span-2">
                <textarea
                  rows={3}
                  className="form-control form-control-pro"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the issue"
                />
                <label>Description</label>
              </div>
              <div className="col-span-2">
                <button className="btn btn-primary w-100"><Icon name="send" /> Submit</button>
              </div>
            </form>
          </section>
        )}

        {/* Toolbar */}
        <section className="card card-pro toolbar">
          <div className="toolbar-row">
            <div className="search-wrap">
              <Icon name="search" />
              <input
                className="search-input"
                placeholder="Search by title or student name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="segmented">
              {['ALL', 'Pending', 'In Progress', 'Resolved'].map(s => (
                <button
                  key={s}
                  type="button"
                  className={`seg-btn ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* List / Table */}
        <section className="card card-pro">
          <div className="card-head head-inline">
            <h6><Icon name="list" /> Complaints</h6>
            <div className="chipset">
              <span className="chip chip-warning">Pending: {kpi.pending}</span>
              <span className="chip chip-info">In Progress: {kpi.inprog}</span>
              <span className="chip chip-success">Resolved: {kpi.resolved}</span>
            </div>
          </div>

          {loading ? (
            <div className="skeleton-wrap">
              <div className="skeleton skeleton-bar" />
              <div className="skeleton skeleton-table" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-wrap">
              <div className="empty-emoji">🛠️</div>
              <h5>No complaints</h5>
              <p className="muted">Try another filter or ask students to submit via the form above.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{width: 44}}></th>
                    <th>Title</th>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Created</th>
                    {isAdmin && <th className="text-end">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const e = edit[c.complaint_id] || {
                      status: c.status,
                      assigned_to_staff_id: c.assigned_to_staff_id || ''
                    };
                    return (
                      <tr key={c.complaint_id} className="row-hover">
                        <td>
                          {c.photo_url ? (
                            <a href={c.photo_url} target="_blank" rel="noreferrer">
                              <img
                                src={c.photo_url}
                                alt=""
                                className="thumb"
                                onError={(ev) => (ev.currentTarget.style.visibility = 'hidden')}
                              />
                            </a>
                          ) : <div className="thumb placeholder">🖼️</div>}
                        </td>
                        <td>
                          <div className="title-cell">{c.title}</div>
                          {c.description && <div className="muted small clamp-2">{c.description}</div>}
                        </td>
                        <td>{c.first_name} {c.last_name}</td>
                        <td>
                          {isAdmin ? (
                            <select
                              className="form-select form-select-sm w-auto"
                              value={e.status}
                              onChange={ev => setEdit(prev => ({ ...prev, [c.complaint_id]: { ...e, status: ev.target.value } }))}
                            >
                              <option>Pending</option>
                              <option>In Progress</option>
                              <option>Resolved</option>
                            </select>
                          ) : (
                            <span className={`badge status ${badgeClass(c.status)}`}>{c.status}</span>
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <select
                              className="form-select form-select-sm"
                              value={e.assigned_to_staff_id}
                              onChange={ev => setEdit(prev => ({ ...prev, [c.complaint_id]: { ...e, assigned_to_staff_id: ev.target.value } }))}
                            >
                              <option value="">Unassigned</option>
                              {staff.map(s => (<option key={s.staff_id} value={s.staff_id}>{s.name}</option>))}
                            </select>
                          ) : (
                            c.assigned_staff_name || '-'
                          )}
                        </td>
                        <td>{new Date(c.created_at).toLocaleString()}</td>
                        {isAdmin && (
                          <td className="text-end">
                            <button className="btn btn-sm btn-success" onClick={() => updateStatus(c.complaint_id)}>
                              <Icon name="save" /> Save
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* ---------- helpers / UI bits ---------- */

function badgeClass(status) {
  if (status === 'Resolved') return 'success';
  if (status === 'In Progress') return 'info';
  return 'warning';
}

function Kpi({ label, value, tone = 'default' }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function InlineDot() {
  return <span className="inline-dot" aria-hidden="true" />;
}

function Icon({ name }) {
  switch (name) {
    case 'report':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 3h13l5 5v13H3V3Zm13 0v5h5" /></svg>;
    case 'send':
      return <svg className="icon" viewBox="0 0 24 24"><path d="m2 21 21-9L2 3v7l15 2-15 2v7Z" /></svg>;
    case 'search':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M10 18a8 8 0 1 1 6.32-3.09l4.39 4.39-1.42 1.42-4.39-4.39A8 8 0 0 1 10 18Z"/></svg>;
    case 'list':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/></svg>;
    case 'save':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14l4-4h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/></svg>;
    default:
      return null;
  }
}
