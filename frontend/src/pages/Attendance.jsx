import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import PageHeader from '../components/PageHeader';
import '../styles/attendance.css';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';

export default function Attendance() {
  const [summary, setSummary] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState({ by: 'absent', dir: 'desc' }); // present|absent|name

  // Marking UI state (Admin/Warden)
  const [students, setStudents] = useState([]);
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markSession, setMarkSession] = useState('Day');
  const [marks, setMarks] = useState({}); // { [student_id]: 'Present'|'Absent' }
  const [markBusy, setMarkBusy] = useState(false);
  const [markMsg, setMarkMsg] = useState('');
  const [markErr, setMarkErr] = useState('');

  const load = async (m) => {
    setBusy(true);
    try {
      const { data } = await API.get('/attendance/summary', { params: { month: m } });
      setSummary(Array.isArray(data) ? data : []);
    } catch {
      setSummary([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(month); }, [month]);

  // Load student list for marking
  useEffect(() => {
    API.get('/students')
      .then(({ data }) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => setStudents([]));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = summary
      .filter(r => {
        if (!term) return true;
        const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase();
        return name.includes(term) || String(r.student_id).includes(term);
      })
      .map(r => ({
        ...r,
        name: (r.first_name || r.last_name)
          ? `${r.first_name || ''} ${r.last_name || ''}`.trim()
          : `ID ${r.student_id}`,
        rate: (Number(r.present || 0) + Number(r.absent || 0)) > 0
          ? Number(r.present) / (Number(r.present) + Number(r.absent))
          : 0
      }));

    const dir = sort.dir === 'asc' ? 1 : -1;
    const by = sort.by;
    rows.sort((a, b) => {
      if (by === 'name') return a.name.localeCompare(b.name) * dir;
      if (by === 'present') return (Number(a.present) - Number(b.present)) * dir;
      if (by === 'absent') return (Number(a.absent) - Number(b.absent)) * dir;
      if (by === 'rate') return (a.rate - b.rate) * dir;
      return 0;
    });
    return rows;
  }, [summary, q, sort]);

  // DataGrid rows and columns
  const dgRows = useMemo(() => {
    return filtered.map((r) => {
      const presentDay = Number(r.present_day || 0);
      const absentDay = Number(r.absent_day || 0);
      const presentNight = Number(r.present_night || 0);
      const absentNight = Number(r.absent_night || 0);
      const presentTotal = presentDay + presentNight;
      const absentTotal = absentDay + absentNight;
      const total = presentTotal + absentTotal;
      const rate = total > 0 ? presentTotal / total : 0;
      return {
        id: `${r.student_id}-${r.ym || r.date || month}`,
        student_id: r.student_id,
        name: r.name,
        monthStr: r.ym || r.date || month,
        present_day: presentDay,
        absent_day: absentDay,
        present_night: presentNight,
        absent_night: absentNight,
        present_total: presentTotal,
        absent_total: absentTotal,
        rate,
      };
    });
  }, [filtered, month]);

  const dgColumns = useMemo(() => {
    return [
      { field: 'name', headerName: 'Student', flex: 1, minWidth: 200 },
      { field: 'monthStr', headerName: 'Month', width: 140 },
      { field: 'present_day', headerName: 'Day Present', type: 'number', width: 130, align: 'right', headerAlign: 'right' },
      { field: 'absent_day', headerName: 'Day Absent', type: 'number', width: 120, align: 'right', headerAlign: 'right' },
      { field: 'present_night', headerName: 'Night Present', type: 'number', width: 140, align: 'right', headerAlign: 'right' },
      { field: 'absent_night', headerName: 'Night Absent', type: 'number', width: 130, align: 'right', headerAlign: 'right' },
      {
        field: 'rate',
        headerName: 'Overall Attendance',
        sortable: true,
        width: 220,
        renderCell: (params) => {
          const p = Number(params.row.present_total || 0);
          const a = Number(params.row.absent_total || 0);
          const total = p + a;
          const ratio = total > 0 ? p / total : 0;
          return (
            <div style={{ width: '100%' }}>
              <Bar ratio={ratio} present={p} absent={a} />
            </div>
          );
        },
      },
    ];
  }, []);

  const kpi = useMemo(() => {
    const totalStudents = summary.length;
    const present = summary.reduce((s, r) => s + Number(r.present || 0), 0);
    const absent = summary.reduce((s, r) => s + Number(r.absent || 0), 0);
    const totalDays = present + absent;
    const avgAttendance = totalDays > 0 ? (present / totalDays) : 0;
    return { totalStudents, present, absent, avgAttendance };
  }, [summary]);

  const setSortBy = (by) => {
    setSort(s => (s.by === by ? { by, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'desc' }));
  };

  const exportCSV = () => {
    const headers = ['Student','Month','Present','Absent','Attendance%'];
    const lines = filtered.map(r => [
      `"${r.name.replace(/"/g,'""')}"`,
      r.ym,
      r.present,
      r.absent,
      ((r.rate*100).toFixed(1))+'%'
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance_${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Monthly present/absent summary"
        actions={
          <div className="actions-wrap">
            <input
              type="month"
              className="form-control"
              style={{ minWidth: '170px' }}
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
            <button className="btn btn-custom-refresh" onClick={() => load(month)}>
              <Icon name="refresh" /> Refresh
            </button>
            <button className="btn btn-custom-export" onClick={exportCSV}>
              <Icon name="download" /> Export CSV
            </button>
          </div>
        }
      />

      <div className="container py-4 attendance-shell">
        {/* Mark Attendance */}
        <section className="card card-pro">
          <div className="card-head head-inline">
            <h6>Mark Attendance</h6>
            {markMsg && <span className="chip chip-success">{markMsg}</span>}
            {markErr && !markMsg && <span className="chip chip-danger">{markErr}</span>}
          </div>
          <div className="vstack gap-3 p-2">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={markDate} onChange={e => setMarkDate(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Session</label>
                <select className="form-select" value={markSession} onChange={e => setMarkSession(e.target.value)}>
                  <option>Day</option>
                  <option>Night</option>
                </select>
              </div>
              <div className="col-md-6 d-flex gap-2">
                <button type="button" className="btn btn-outline-success" onClick={() => {
                  const m = {}; students.forEach(s => { m[s.student_id] = 'Present'; }); setMarks(m);
                }}>All Present</button>
                <button type="button" className="btn btn-outline-danger" onClick={() => {
                  const m = {}; students.forEach(s => { m[s.student_id] = 'Absent'; }); setMarks(m);
                }}>All Absent</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setMarks({})}>Clear</button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Student</th>
                    <th style={{ width: 220 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr><td colSpan={2}><div className="sd-empty py-3">No students found</div></td></tr>
                  ) : students.map(s => {
                    const sid = s.student_id;
                    const val = marks[sid] || 'Present';
                    const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || `ID ${sid}`;
                    return (
                      <tr key={sid}>
                        <td>{name} <span className="muted">({s.email})</span></td>
                        <td>
                          <div className="segmented" role="group" aria-label={`Attendance ${name}`}>
                            <button type="button" className={`seg-btn ${val==='Present'?'active':''}`} onClick={() => setMarks(m => ({ ...m, [sid]: 'Present' }))}>Present</button>
                            <button type="button" className={`seg-btn ${val==='Absent'?'active':''}`} onClick={() => setMarks(m => ({ ...m, [sid]: 'Absent' }))}>Absent</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-end">
              <button
                className="btn btn-primary"
                disabled={markBusy || students.length === 0}
                onClick={async () => {
                  setMarkErr(''); setMarkMsg(''); setMarkBusy(true);
                  try {
                    const payload = {
                      date: markDate,
                      session: markSession,
                      marks: students.map(s => ({ student_id: s.student_id, status: marks[s.student_id] || 'Present' }))
                    };
                    await API.post('/attendance/mark', payload);
                    setMarkMsg('Attendance saved');
                    // Refresh summary for current month
                    const ym = markDate.slice(0,7);
                    if (ym === month) { await load(month); }
                  } catch (e) {
                    setMarkErr(e.response?.data?.message || 'Failed to save');
                  } finally {
                    setMarkBusy(false);
                  }
                }}
              >
                {markBusy ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </section>
        {/* KPIs */}
        <section className="kpi-row">
          <Kpi label="Students" value={kpi.totalStudents} />
          <Kpi label="Total Present" value={kpi.present} tone="success" />
          <Kpi label="Total Absent" value={kpi.absent} tone="danger" />
          <Kpi label="Avg Attendance" value={(kpi.avgAttendance*100).toFixed(1) + '%'} tone="info" />
        </section>

        {/* Toolbar */}
        <section className="card card-pro toolbar">
          <div className="toolbar-row">
            <div className="search-wrap">
              <Icon name="search" />
              <input
                className="search-input"
                placeholder="Search student name or ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="segmented">
              <button
                type="button"
                className={`seg-btn ${sort.by==='absent' ? 'active' : ''}`}
                onClick={() => setSortBy('absent')}
                title="Sort by Absent"
              >Absent {sort.by==='absent' ? (sort.dir==='asc'?'↑':'↓') : ''}</button>
              <button
                type="button"
                className={`seg-btn ${sort.by==='present' ? 'active' : ''}`}
                onClick={() => setSortBy('present')}
                title="Sort by Present"
              >Present {sort.by==='present' ? (sort.dir==='asc'?'↑':'↓') : ''}</button>
              <button
                type="button"
                className={`seg-btn ${sort.by==='rate' ? 'active' : ''}`}
                onClick={() => setSortBy('rate')}
                title="Sort by %"
              >% {sort.by==='rate' ? (sort.dir==='asc'?'↑':'↓') : ''}</button>
              <button
                type="button"
                className={`seg-btn ${sort.by==='name' ? 'active' : ''}`}
                onClick={() => setSortBy('name')}
                title="Sort by Name"
              >Name {sort.by==='name' ? (sort.dir==='asc'?'↑':'↓') : ''}</button>
            </div>
          </div>
        </section>

        {/* Table */}
      {/* Table */}
<section className="card card-pro">
  <div className="card-head head-inline">
    <h6><Icon name="table" /> {month} — Attendance</h6>
    <div className="chipset">
      <span className="chip chip-success">Present: {kpi.present}</span>
      <span className="chip chip-danger">Absent: {kpi.absent}</span>
      <span className="chip">{filtered.length} students</span>
    </div>
  </div>

  {busy ? (
    <div className="skeleton-wrap">
      <div className="skeleton skeleton-bar" />
      <div className="skeleton skeleton-table" />
    </div>
  ) : filtered.length === 0 ? (
    <div className="empty-wrap">
      <div className="empty-emoji">📅</div>
      <h5>No records</h5>
      <p className="muted">Try a different month or clear the search.</p>
    </div>
  ) : (
    <div style={{ width: '100%' }}>
      <DataGrid
        autoHeight
        rows={dgRows}
        columns={dgColumns}
        loading={busy}
        density="compact"
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25, page: 0 } },
          sorting: { sortModel: [{ field: 'absent_total', sort: 'desc' }] },
        }}
        slots={{ toolbar: GridToolbar }}
        slotProps={{ toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }}
      />
    </div>
  )}
</section>

      </div>
    </>
  );
}

/* ----- UI bits (no extra libs) ----- */

function Kpi({ label, value, tone = 'default' }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

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

function Icon({ name }) {
  switch (name) {
    case 'search':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M10 18a8 8 0 1 1 6.32-3.09l4.39 4.39-1.42 1.42-4.39-4.39A8 8 0 0 1 10 18Z"/></svg>;
    case 'table':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 5h18v14H3V5Zm2 2v3h14V7H5Zm14 5H5v5h14v-5Z"/></svg>;
    case 'download':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M12 3v10.59l3.3-3.3 1.4 1.42L12 17.41 7.3 11.7l1.4-1.41 3.3 3.3V3h2ZM5 19h14v2H5v-2Z"/></svg>;
    case 'refresh':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.9 6h-2.06A6 6 0 1 1 12 6c1.66 0 3.14.68 4.22 1.78L14 10h7V3l-3.35 3.35Z"/></svg>;
    default:
      return null;
  }
}
