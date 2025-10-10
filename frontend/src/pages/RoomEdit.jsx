import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { API } from '../api';

export default function RoomEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [form, setForm] = useState({ room_number: '', capacity: 1, status: 'Vacant' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    API.get(`/rooms/rooms/${id}`)
      .then(({ data }) => {
        if (!mounted) return;
        setRoom(data);
        setForm({
          room_number: data.room_number || '',
          capacity: data.capacity ?? 1,
          status: data.status || 'Vacant',
        });
      })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load room'))
      .finally(() => setLoading(false));
    return () => { mounted = false };
  }, [id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await API.put(`/rooms/rooms/${id}`, {
        room_number: form.room_number,
        capacity: Number(form.capacity),
        status: form.status,
      });
      setMessage('Room updated successfully');
      setTimeout(() => navigate('/rooms'), 600);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update room');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container py-4"><div className="skeleton skeleton-bar" /><div className="skeleton skeleton-grid" /></div>;
  if (!room) return <div className="container py-4"><div className="alert alert-danger">{error || 'Room not found'}</div></div>;

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <div className="mb-3">
        <Link to="/rooms" className="btn btn-link p-0">← Back to Rooms</Link>
      </div>
      <div className="card card-pro">
        <div className="card-head">
          <h6>Edit Room</h6>
          <p className="muted small">{room.block}-{room.floor} • Room #{room.room_number}</p>
        </div>
        {message && <div className="alert alert-success m-3 mt-0">{message}</div>}
        {error && !message && <div className="alert alert-danger m-3 mt-0">{error}</div>}
        <form onSubmit={onSubmit} className="vstack gap-3 p-3">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Room Number</label>
              <input
                className="form-control"
                value={form.room_number}
                onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Capacity</label>
              <input
                type="number"
                min={1}
                className="form-control"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                disabled
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Vacant">Vacant</option>
                <option value="Occupied">Occupied</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/rooms')}>Cancel</button>
            <button disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

