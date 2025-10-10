import React, { useEffect, useState } from 'react';
import { API } from '../api';
import PageHeader from '../components/PageHeader';

const ROLES = ['Admin', 'Warden', 'Student'];

export default function ManageCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('Student');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/codes');
      setCodes(data);
    } catch (e) {
      setError('Failed to load codes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await API.post('/codes', { role });
      setCodes((prev) => [data, ...prev]);
    } catch (e) {
      setError('Failed to generate code');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this code?')) return;
    try {
      await API.delete(`/codes/${id}`);
      setCodes((prev) => prev.filter((c) => c.code_id !== id));
    } catch (e) {
      setError('Failed to delete code');
    }
  }

  return (
    <>
      <PageHeader title="Manage Codes" subtitle="Generate and manage registration codes" />

    <div className="container py-4">
      
      <div className="card mb-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={handleGenerate}>
            <div className="col-auto">
              <label className="form-label">Role</label>
              <select className="form-select" value={role} onChange={(e)=>setRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <button className="btn btn-primary" type="submit">Generate Code</button>
            </div>
          </form>
          {error && <div className="text-danger mt-2">{error}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Working Codes</strong>
          <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th style={{width:'110px'}}>Role</th>
                  <th>Code</th>
                  <th style={{width:'200px'}}>Created</th>
                  <th style={{width:'100px'}}></th>
                </tr>
              </thead>
              <tbody>
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-4">No active codes</td>
                  </tr>
                )}
                {codes.map(c => (
                  <tr key={c.code_id}>
                    <td><span className="badge bg-secondary">{c.role}</span></td>
                    <td style={{fontFamily:'monospace'}}>{c.code}</td>
                    <td>{new Date(c.created_at).toLocaleString()}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDelete(c.code_id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

