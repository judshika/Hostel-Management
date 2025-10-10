import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Alert from '@mui/material/Alert';
import RoomGrid from '../components/RoomGrid';
import '../styles/rooms.css';

export default function Rooms() {
  const { user } = useAuth();

  // Data
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);

  // Forms
  const [alloc, setAlloc] = useState({ student_id: '', room_id: '', start_date: '' });
  const [blkName, setBlkName] = useState('');
  const [floor, setFloor] = useState({ block_id: '', name: '' });
  const [room, setRoom] = useState({ floor_id: '', room_number: '', capacity: 2 });

  // UI state
  const [msg, setMsg] = useState('');
  const [errMsg, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      if (user && user.role !== 'Student') {
        const st = await API.get('/students');
        setStudents(st.data || []);
      }
      const rg = await API.get('/rooms/rooms-grid');
      setRooms(rg.data || []);
      // Optional (if your API supports listing):
      try {
        const [b, f] = await Promise.allSettled([
          API.get('/rooms/blocks'),
          API.get('/rooms/floors'),
        ]);
        if (b.status === 'fulfilled') setBlocks(b.value.data || []);
        if (f.status === 'fulfilled') setFloors(f.value.data || []);
      } catch {}
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to load data');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Available rooms include both fully empty and partially occupied, excluding maintenance
  const vacantRooms = useMemo(
    () => rooms.filter(r => r.status !== 'Maintenance' && (Number(r.active_count || 0) < Number(r.capacity))),
    [rooms]
  );

  // Form handlers
  const createBlock = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      const { data } = await API.post('/rooms/blocks', { name: blkName });
      setBlkName('');
      setMsg('Block created: ' + data.block_id);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create block');
    } finally { load(); }
  };

  const createFloor = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      const { data } = await API.post('/rooms/floors', floor);
      setFloor({ block_id: '', name: '' });
      setMsg('Floor created: ' + data.floor_id);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create floor');
    } finally { load(); }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      const { data } = await API.post('/rooms/rooms', room);
      setRoom({ floor_id: '', room_number: '', capacity: 2 });
      setMsg('Room created: ' + data.room_id);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create room');
    } finally { load(); }
  };

  const allocate = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      await API.post('/rooms/allocate', alloc);
      setMsg('Allocated');
      setAlloc({ student_id: '', room_id: '', start_date: '' });
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to allocate');
    } finally { load(); }
  };

  const isAdminOrWarden = user?.role === 'Admin' || user?.role === 'Warden';

  // Quick KPIs
  const kpi = useMemo(() => {
  const total = rooms.length;
  const occupied = rooms.filter(r => r.status === 'Occupied').length;
  const partial = rooms.filter(r => r.status === 'Partial').length;
  const vacant = rooms.filter(r => r.status === 'Vacant').length;
  const available = partial + vacant;
  const maintenance = rooms.filter(r => r.status === 'Maintenance').length;
  return { total, occupied, partial, vacant, available, maintenance };
}, [rooms]);


  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle="Blocks, floors, rooms and allocations"
        extra={
          <span className="chip chip-muted">
            <InlineDot /> Updated just now
          </span>
        }
      />

      <div className="container py-4 rooms-shell">
        {(msg || errMsg) && (
          <div className="mb-3">
            {msg && <Alert severity="success" className="mb-2">{msg}</Alert>}
            {errMsg && <Alert severity="error" className="mb-2">{errMsg}</Alert>}
          </div>
        )}

        {/* KPIs */}
     <section className="kpi-row"c>
  <b><KpiCard label="Total Rooms" value={kpi.total} /></b>
  <b><KpiCard label="Occupied" value={kpi.occupied} tone="warning" /></b>
  <b><KpiCard label="Partial" value={kpi.partial} tone="info" /></b>
  <b><KpiCard label="Vacant" value={kpi.vacant} tone="success" /></b>
  <b><KpiCard label="Maintenance" value={kpi.maintenance} tone="danger" /></b>
</section>



        {/* Admin/Warden controls */}
        {isAdminOrWarden && (
          <section className="grid-12 mb-12 gap-3">
            {/* Create Block */}
            <div className="card card-pro">
              <div className="card-head">
                <h6><InlineIcon name="block" /> Create Block</h6>
                <p className="muted small">Add a new block to the hostel.</p>
              </div>
              <form onSubmit={createBlock} className="vstack-12">
                <div className="form-floating-pro">
                  <input
                    className="form-control form-control-pro"
                    placeholder="Block name"
                    value={blkName}
                    onChange={e => setBlkName(e.target.value)}
                    required
                  />
                  <label>Block name</label>
                </div>
                <button className="btn btn-primary w-100">Add Block</button>
              </form>
            </div>
<br/>
            {/* Create Floor */}
            <div className="card card-pro">
              <div className="card-head">
                <h6><InlineIcon name="floor" /> Create Floor</h6>
                <p className="muted small">Attach a floor under a block.</p>
              </div>
              <form onSubmit={createFloor} className="grid-2 vstack-12">
                <div className="form-floating-pro">
                  <select
                    className="form-select form-control-pro"
                    value={floor.block_id}
                    onChange={e => setFloor(f => ({ ...f, block_id: e.target.value }))}
                    required
                  >
                    <option value="">Select block</option>
                    {blocks.map(b => (
                      <option key={b.block_id} value={b.block_id}>
                        {b.name || `Block ${b.block_id}`}
                      </option>
                    ))}
                  </select>
                  <label>Block</label>
                </div>
                <div className="form-floating-pro">
                  <input
                    className="form-control form-control-pro"
                    placeholder="Floor name"
                    value={floor.name}
                    onChange={e => setFloor(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                  <label>Floor name</label>
                </div>
                <div className="col-span-2">
                  <button className="btn btn-primary w-100">Add Floor</button>
                </div>
              </form>
            </div>
<br/>
            {/* Create Room */}
            <div className="card card-pro">
              <div className="card-head">
                <h6><InlineIcon name="room" /> Create Room</h6>
                <p className="muted small">Set room number and capacity.</p>
              </div>
              <form onSubmit={createRoom} className="grid-3 vstack-12">
                <div className="form-floating-pro">
                  <select
                    className="form-select form-control-pro"
                    value={room.floor_id}
                    onChange={e => setRoom(r => ({ ...r, floor_id: e.target.value }))}
                    required
                  >
                    <option value="">Select floor</option>
                    {floors.map(f => (
                      <option key={f.floor_id} value={f.floor_id}>
                        {(f.block_name ? `${f.block_name} • ` : '') + (f.name || `Floor ${f.floor_id}`)}
                      </option>
                    ))}
                  </select>
                  <label>Floor</label>
                </div>
                <div className="form-floating-pro">
                  <input
                    className="form-control form-control-pro"
                    placeholder="Room #"
                    value={room.room_number}
                    onChange={e => setRoom(r => ({ ...r, room_number: e.target.value }))}
                    required
                  />
                  <label>Room #</label>
                </div>
                <div className="form-floating-pro">
                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-pro"
                    placeholder="Capacity"
                    value={room.capacity}
                    onChange={e => setRoom(r => ({ ...r, capacity: e.target.value }))}
                    required
                  />
                  <label>Capacity</label>
                </div>
                <div className="col-span-3">
                  <button className="btn btn-primary w-100">Add Room</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* Allocation */}
        {isAdminOrWarden && (
          <section className="card card-pro mb-4">
            <div className="card-head">
              <h6><InlineIcon name="assign" /> Allocate Room to Student</h6>
              <p className="muted small">
                Choose a student, pick a vacant room, and set the start date.
              </p>
            </div>
            <form onSubmit={allocate} className="grid-4 vstack-12 align-end">
              <div className="form-floating-pro">
                <select
                  className="form-select form-control-pro"
                  value={alloc.student_id}
                  onChange={e => setAlloc(a => ({ ...a, student_id: e.target.value }))}
                  required
                >
                  <option value="">Select student</option>
                  {students.map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.first_name} {s.last_name} ({s.email})
                    </option>
                  ))}
                </select>
                <label>Student</label>
              </div>

              <div className="form-floating-pro">
                <select
                  className="form-select form-control-pro"
                  value={alloc.room_id}
                  onChange={e => setAlloc(a => ({ ...a, room_id: e.target.value }))}
                  required
                >
                  <option value="">Select room</option>
                  {vacantRooms.map(r => (
                    <option key={r.room_id} value={r.room_id}>
                      {r.block}-{r.floor} #{r.room_number}
                    </option>
                  ))}
                </select>
                <label>Vacant Room</label>
              </div>

              <div className="form-floating-pro">
                <input
                  type="date"
                  className="form-control form-control-pro"
                  value={alloc.start_date}
                  onChange={e => setAlloc(a => ({ ...a, start_date: e.target.value }))}
                  required
                />
                <label>Start Date</label>
              </div>

              <div>
                <button className="btn btn-success w-100">
                  <InlineIcon name="check" /> Allocate
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Rooms grid viewer */}
        <section className="card card-pro">
          <div className="card-head head-inline">
            <h6><InlineIcon name="grid" /> Room Grid</h6>
            <div className="chipset">
              <span className="chip chip-success">Vacant: {kpi.vacant}</span>
              <span className="chip">Partial: {kpi.partial}</span>
              <span className="chip chip-success">Available: {kpi.available}</span>
              <span className="chip chip-warning">Occupied: {kpi.occupied}</span>
              <span className="chip chip-danger">Maintenance: {kpi.maintenance}</span>
            </div>
          </div>

          {busy ? (
            <div className="skeleton-wrap">
              <div className="skeleton skeleton-bar" />
              <div className="skeleton skeleton-grid" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-wrap">
              <div className="empty-emoji">🏠</div>
              <h5>No rooms yet</h5>
              <p className="muted">Create a block, add floors, then create rooms to get started.</p>
            </div>
          ) : (
            <div className="roomgrid-padded">
              <RoomGrid rooms={rooms} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* ---------------- UI bits ---------------- */

function KpiCard({ label, value, tone = 'default' }) {
  return (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{Number.isFinite(value) ? value : 0}</div>
    </div>
  );
}

function InlineDot() {
  return <span className="inline-dot" aria-hidden="true" />;
}

function InlineIcon({ name }) {
  switch (name) {
    case 'block':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"/></svg>;
    case 'floor':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 5h18v2H3V5Zm0 6h18v2H3v-2Zm0 6h18v2H3v-2Z"/></svg>;
    case 'room':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4V4Zm10 8h4v6h-4v-6Z"/></svg>;
    case 'assign':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-9 9a9 9 0 0 1 18 0H3Z"/></svg>;
    case 'check':
      return <svg className="icon" viewBox="0 0 24 24"><path d="m9 16.17-3.88-3.88L4 13.41 9 18.41 20.59 6.83 19.17 5.41 9 16.17Z"/></svg>;
    case 'grid':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z"/></svg>;
    default:
      return null;
  }
}
