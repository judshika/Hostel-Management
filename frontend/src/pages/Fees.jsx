import React, { useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import PageHeader from '../components/PageHeader';
import Alert from '@mui/material/Alert';
import '../styles/fees.css';

const MONEY = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '0.00');

export default function Fees() {
  const [bills, setBills] = useState([]);
  const [structures, setStructures] = useState([]);
  const [students, setStudents] = useState([]);
  const [gen, setGen] = useState({ month_year: '', default_fee_id: '' });
  const [create, setCreate] = useState({ student_id: '', month_year: '', amount: '', discount: '' });
  const [pay, setPay] = useState({ bill_id: '', amount: '', method: 'Cash', reference: '' });

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | PAID | PARTIAL | UNPAID
  const [q, setQ] = useState(''); // search by student or month

  const load = async () => {
    setBusy(true);
    try {
      const [bl, fs, st] = await Promise.all([
        API.get('/fees/bills'),
        API.get('/fees/structures'),
        API.get('/students'),
      ]);
      setBills(bl.data || []);
      setStructures(fs.data || []);
      setStudents(st.data || []);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to load fees data');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, []);

  const generate = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      await API.post('/fees/generate', gen);
      setMsg('Monthly bills generated');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to generate');
    } finally {
      setGen({ month_year: '', default_fee_id: '' }); load();
    }
  };

  const createBill = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      await API.post('/fees/create', create);
      setMsg('Bill created');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to create bill');
    } finally {
      setCreate({ student_id: '', month_year: '', amount: '', discount: '' }); load();
    }
  };

  const payBill = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      await API.post('/fees/pay', pay);
      setMsg('Payment recorded');
      setPay({ bill_id: '', amount: '', method: 'Cash', reference: '' });
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to record payment');
    } finally {
      load();
    }
  };

  // KPIs
  const kpi = useMemo(() => {
    const total = bills.length;
    const paid = bills.filter(b => b.status === 'PAID').length;
    const partial = bills.filter(b => b.status === 'PARTIAL').length;
    const unpaid = bills.filter(b => b.status === 'UNPAID').length;
    const totalAmount = bills.reduce((s, b) => s + Number(b.total || 0), 0);
    const outstanding = bills
      .filter(b => b.status !== 'PAID')
      .reduce((s, b) => s + Number(b.balance ?? b.total ?? 0), 0);
    return { total, paid, partial, unpaid, totalAmount, outstanding };
  }, [bills]);

  // Filtered bills
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return bills.filter(b => {
      const matchesStatus = statusFilter === 'ALL' ? true : b.status === statusFilter;
      const studentName = `${b.first_name ?? ''} ${b.last_name ?? ''}`.toLowerCase();
      const matchesTerm = !term || studentName.includes(term) || (b.month_year ?? '').includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [bills, statusFilter, q]);

  return (
    <>
      <PageHeader
        title="Fee Management"
        subtitle="Generate monthly bills, create one-offs, and record payments"
        extra={<span className="chip chip-muted"><LiveDot /> Live</span>}
      />

      <div className="container py-4 fees-shell">
        {(msg || err) && (
          <div className="mb-3">
            {msg && <Alert severity="success" className="mb-2">{msg}</Alert>}
            {err && <Alert severity="error" className="mb-2">{err}</Alert>}
          </div>
        )}

        {/* KPIs */}
        <section className="kpi-row">
          <Kpi label="Total Bills" value={kpi.total} />
          <Kpi label="Paid" value={kpi.paid} tone="success" />
          <Kpi label="Partial" value={kpi.partial} tone="warning" />
          <Kpi label="Unpaid" value={kpi.unpaid} tone="danger" />
          <Kpi label="Total Amount (Rs.)" value={MONEY(kpi.totalAmount)} wide />
          <Kpi label="Outstanding (Rs.)" value={MONEY(kpi.outstanding)} tone="danger" wide />
        </section>

        {/* Forms */}
        <section className="grid-12 ">
          {/* Create Single Bill */}
         {/* Create Single Bill */}
<div className="card card-pro">
  <div className="card-head">
    <h6><Icon name="plus" /> Create Single Bill</h6>
    <p className="muted small">Issue a one-off bill for a student.</p>
  </div>
  <form onSubmit={createBill} className="grid-4 vstack-12">
    <div className="form-floating-pro col-span-2">
      <select
        className="form-select form-control-pro"
        value={create.student_id}
        onChange={e => setCreate(c => ({ ...c, student_id: e.target.value }))}
        required
      >
        <option value="">Select student</option>
        {students.map(s => (
          <option key={s.student_id} value={s.student_id}>
            {s.first_name} {s.last_name}
          </option>
        ))}
      </select>
      <label>Student</label>
    </div>

    {/* ✅ FIXED: Use "month" input instead of "date" */}
    <div className="form-floating-pro">
      <input
        type="month"
        className="form-control form-control-pro"
        value={create.month_year}
        onChange={e => setCreate(c => ({ ...c, month_year: e.target.value }))}
        required
      />
      <label>Select Month</label>
    </div>

    <div className="form-floating-pro">
      <input
        className="form-control form-control-pro"
        placeholder="Amount"
        value={create.amount}
        onChange={e => setCreate(c => ({ ...c, amount: e.target.value }))}
        required
        inputMode="decimal"
      />
      <label>Amount (Rs.)</label>
    </div>

    <div className="form-floating-pro col-span-4">
      <input
        className="form-control form-control-pro"
        placeholder="Discount"
        value={create.discount}
        onChange={e => setCreate(c => ({ ...c, discount: e.target.value }))}
        inputMode="decimal"
      />
      <label>Discount (optional)</label>
    </div>

    <div className="col-span-4">
      <button className="btn btn-success w-100">
        <Icon name="check" /> Create Bill
      </button>
    </div>
  </form>
</div>

        </section>

        {/* Toolbar */}
        <section className="toolbar card card-pro">
          <div className="toolbar-row">
            <div className="search-wrap">
              <Icon name="search" />
              <input
                className="search-input"
                placeholder="Search by student or month (e.g., 2025-10)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="segmented">
              {['ALL', 'PAID', 'PARTIAL', 'UNPAID'].map(s => (
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

        {/* Bills Table */}
        <section className="card card-pro">
          <div className="card-head head-inline">
            <h6><Icon name="table" /> Bills</h6>
            <div className="chipset">
              <span className="chip chip-success">Paid: {kpi.paid}</span>
              <span className="chip chip-warning">Partial: {kpi.partial}</span>
              <span className="chip chip-danger">Unpaid: {kpi.unpaid}</span>
            </div>
          </div>

          {busy ? (
            <div className="skeleton-wrap">
              <div className="skeleton skeleton-bar" />
              <div className="skeleton skeleton-table" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-wrap">
              <div className="empty-emoji">🧾</div>
              <h5>No bills to show</h5>
              <p className="muted">Try adjusting the filters or run monthly generation.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Student</th>
                    <th>Month</th>
                    <th className="text-end">Total (Rs.)</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.bill_id} className="row-hover">
                      <td>{b.first_name} {b.last_name}</td>
                      <td>{b.month_year}</td>
                      <td className="text-end">{MONEY(b.total)}{b.status !== 'UNPAID' ? ` (Paid: ${MONEY(b.paid || 0)} | Due: ${MONEY(b.balance ?? Math.max(0, Number(b.total||0) - Number(b.paid||0)))})` : ''}</td>
                      <td>
                        <span className={`badge status ${b.status.toLowerCase()}`}>{b.status}</span>
                      </td>
                      <td className="text-end">
                        {b.status !== 'PAID' && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => setPay({ bill_id: b.bill_id, amount: (b.balance ?? Math.max(0, Number(b.total||0) - Number(b.paid||0))).toFixed(2), method: 'Cash', reference: '' })}
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2}>Totals</th>
                    <th className="text-end">Rs. {MONEY(filtered.reduce((s, b) => s + Number(b.total || 0), 0))}</th>
                    <th colSpan={2}></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Payment Drawer/Card */}
        {pay.bill_id && (
          <section className="card card-pro pay-card">
            <div className="card-head">
              <h6><Icon name="credit" /> Record Payment</h6>
              <p className="muted small">Bill ID: {pay.bill_id}</p>
            </div>
            <form onSubmit={payBill} className="grid-4 vstack-12">
              <div className="form-floating-pro">
                <input
                  className="form-control form-control-pro"
                  value={pay.amount}
                  onChange={e => setPay(p => ({ ...p, amount: e.target.value }))}
                  required
                  inputMode="decimal"
                  placeholder="Amount"
                />
                <label>Amount (Rs.)</label>
              </div>
              <div className="form-floating-pro">
                <select
                  className="form-select form-control-pro"
                  value={pay.method}
                  onChange={e => setPay(p => ({ ...p, method: e.target.value }))}
                >
                  <option>Cash</option>
                  <option>Card</option>
                  <option>UPI</option>
                </select>
                <label>Method</label>
              </div>
              <div className="form-floating-pro col-span-2">
                <input
                  className="form-control form-control-pro"
                  placeholder="Reference / Notes"
                  value={pay.reference}
                  onChange={e => setPay(p => ({ ...p, reference: e.target.value }))}
                />
                <label>Reference / Notes</label>
              </div>
              <div className="actions">
                <button className="btn btn-success"><Icon name="check" /> Save</button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setPay({ bill_id: '', amount: '', method: 'Cash', reference: '' })}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </>
  );
}

/* ---------- UI bits ---------- */

function Kpi({ label, value, tone = 'default', wide = false }) {
  return (
    <div className={`kpi ${tone} ${wide ? 'wide' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function LiveDot() {
  return <span className="live-dot" aria-hidden="true" />;
}

function Icon({ name }) {
  switch (name) {
    case 'calendar':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M7 2v3H5a2 2 0 0 0-2 2v3h18V7a2 2 0 0 0-2-2h-2V2h-2v3H9V2H7Zm14 10H3v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7Z"/></svg>;
    case 'play':
      return <svg className="icon" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7V5Z"/></svg>;
    case 'plus':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>;
    case 'check':
      return <svg className="icon" viewBox="0 0 24 24"><path d="m9 16.17-3.88-3.88L4 13.41 9 18.41 20.59 6.83 19.17 5.41 9 16.17Z"/></svg>;
    case 'search':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M10 18a8 8 0 1 1 6.32-3.09l4.39 4.39-1.42 1.42-4.39-4.39A8 8 0 0 1 10 18Z"/></svg>;
    case 'table':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M3 5h18v14H3V5Zm2 2v3h14V7H5Zm14 5H5v5h14v-5Z"/></svg>;
    case 'credit':
      return <svg className="icon" viewBox="0 0 24 24"><path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3H2V6Zm0 5h20v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7Z"/></svg>;
    default:
      return null;
  }
}
