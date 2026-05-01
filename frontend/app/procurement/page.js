'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBadgeClass, fmt, fmtMoney } from '../lib/utils';
import Modal from '../components/Modal';

export default function ProcurementPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const canCreate = hasRole('System_Admin', 'Warehouse_Manager');
  const canApprove = hasRole('System_Admin', 'Finance_Officer');

  const [items, setItems] = useState([]);
  const [resources, setResources] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setSF] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectNotes, setRejectN] = useState('');
  const [submitting, setSub] = useState(false);
  const [form, setForm] = useState({
    resource_id: '', warehouse_id: '', disaster_event_id: '',
    quantity: '', unit_cost: '', supplier_name: '', remarks: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const [proc, res, wh, ev] = await Promise.all([
        api.get(`/api/procurements${params}`),
        api.get('/api/resources'),
        api.get('/api/warehouses'),
        api.get('/api/events'),
      ]);
      setItems(proc);
      setResources(res);
      setWarehouses(wh);
      setEvents(ev);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.resource_name || '').toLowerCase().includes(s) ||
      (p.supplier_name || '').toLowerCase().includes(s) ||
      (p.warehouse_name || '').toLowerCase().includes(s);
  });

  /* ── Create ─────────────────────────────────────────────── */
  async function handleCreate(e) {
    e.preventDefault();
    const { resource_id, warehouse_id, disaster_event_id, quantity, unit_cost, supplier_name } = form;
    if (!resource_id || !warehouse_id || !disaster_event_id || !quantity || !unit_cost || !supplier_name) {
      toast.error('All fields are required'); return;
    }
    setSub(true);
    try {
      await api.post('/api/procurements', {
        resource_id: parseInt(form.resource_id),
        warehouse_id: parseInt(form.warehouse_id),
        disaster_event_id: parseInt(form.disaster_event_id),
        quantity: parseInt(form.quantity),
        unit_cost: parseFloat(form.unit_cost),
        supplier_name: form.supplier_name,
        remarks: form.remarks || undefined,
      });
      toast.success('Procurement request created — awaiting approval');
      setShowCreate(false);
      setForm({ resource_id: '', warehouse_id: '', disaster_event_id: '', quantity: '', unit_cost: '', supplier_name: '', remarks: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  /* ── Approve ────────────────────────────────────────────── */
  async function handleApprove(id) {
    if (!confirm('Approve this procurement? This will update inventory and create a financial transaction.')) return;
    try {
      await api.patch(`/api/procurements/${id}/approve`, {});
      toast.success('Procurement approved — inventory updated');
      load();
    } catch (err) { toast.error(err.message); }
  }

  /* ── Reject ─────────────────────────────────────────────── */
  function openReject(id) {
    setRejectId(id);
    setRejectN('');
    setShowReject(true);
  }

  async function handleReject(e) {
    e.preventDefault();
    setSub(true);
    try {
      await api.patch(`/api/procurements/${rejectId}/reject`, { notes: rejectNotes || undefined });
      toast.success('Procurement rejected');
      setShowReject(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  /* ── Stats ──────────────────────────────────────────────── */
  const pendingCount = items.filter(p => p.status === 'Pending').length;
  const completedCount = items.filter(p => p.status === 'Completed').length;
  const totalCost = items.filter(p => p.status === 'Completed').reduce((s, p) => s + Number(p.total_cost || 0), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>🛒 Procurement</h1>
          <p>Manage resource procurement requests and approval workflow</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Procurement</button>
        )}
      </div>

      {/* ── KPI Strip ──────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card fade-in-up">
          <div className="stat-icon" style={{ background: '#0ea5e920' }}>📋</div>
          <div className="stat-info">
            <div className="label">Total Requests</div>
            <div className="value" style={{ color: '#0ea5e9' }}>{items.length}</div>
          </div>
        </div>
        <div className="stat-card fade-in-up stagger-1">
          <div className="stat-icon" style={{ background: '#f59e0b20' }}>⏳</div>
          <div className="stat-info">
            <div className="label">Pending</div>
            <div className="value" style={{ color: '#f59e0b' }}>{pendingCount}</div>
          </div>
        </div>
        <div className="stat-card fade-in-up stagger-2">
          <div className="stat-icon" style={{ background: '#10b98120' }}>✅</div>
          <div className="stat-info">
            <div className="label">Completed</div>
            <div className="value" style={{ color: '#10b981' }}>{completedCount}</div>
          </div>
        </div>
        <div className="stat-card fade-in-up stagger-3">
          <div className="stat-icon" style={{ background: '#3b82f620' }}>💰</div>
          <div className="stat-info">
            <div className="label">Total Spend</div>
            <div className="value" style={{ color: '#3b82f6', fontSize: '1.2rem' }}>{fmtMoney(totalCost)}</div>
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search resource, supplier, warehouse…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <select className="form-control" value={statusFilter} onChange={e => setSF(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Inactive">Rejected / Inactive</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="table-container">
        <div className="table-header">
          <h3>Procurements ({filtered.length})</h3>
        </div>
        {loading
          ? <div className="loading-container"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">🛒</div><p>No procurements found</p></div>
            : <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Resource</th><th>Supplier</th><th>Warehouse</th><th>Event</th>
                    <th>Qty</th><th>Unit Cost</th><th>Total</th><th>Status</th><th>Date</th>
                    {canApprove && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.procurement_id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.resource_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.resource_type}</div>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{p.supplier_name}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.warehouse_name}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.event_name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{p.quantity?.toLocaleString()}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{fmtMoney(p.unit_cost)}</td>
                      <td style={{ fontWeight: 700, color: '#0ea5e9' }}>{fmtMoney(p.total_cost)}</td>
                      <td><span className={getBadgeClass(p.status)}>{p.status}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(p.procurement_date)}</td>
                      {canApprove && (
                        <td>
                          {p.status === 'Pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleApprove(p.procurement_id)}>
                                Approve
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => openReject(p.procurement_id)}>
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* ── Create Procurement Modal ───────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Procurement Request"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </>
        }>
        <div className="form-group">
          <label>Resource *</label>
          <select className="form-control" value={form.resource_id}
            onChange={e => setForm({ ...form, resource_id: e.target.value })}>
            <option value="">Select resource…</option>
            {resources.map(r => (
              <option key={r.resource_id} value={r.resource_id}>
                {r.resource_name} ({r.resource_type}) — {r.unit_of_measure}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Warehouse *</label>
            <select className="form-control" value={form.warehouse_id}
              onChange={e => setForm({ ...form, warehouse_id: e.target.value })}>
              <option value="">Select warehouse…</option>
              {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Disaster Event *</label>
            <select className="form-control" value={form.disaster_event_id}
              onChange={e => setForm({ ...form, disaster_event_id: e.target.value })}>
              <option value="">Select event…</option>
              {events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Quantity *</label>
            <input className="form-control" type="number" min="1" placeholder="e.g. 500"
              value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Unit Cost (₨) *</label>
            <input className="form-control" type="number" min="1" step="any" placeholder="e.g. 850"
              value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} />
          </div>
        </div>
        {form.quantity && form.unit_cost && (
          <div style={{
            padding: '10px 14px', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-md)',
            fontSize: '0.82rem', marginBottom: 16, display: 'flex', justifyContent: 'space-between'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Estimated Total:</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
              {fmtMoney(parseInt(form.quantity || 0) * parseFloat(form.unit_cost || 0))}
            </span>
          </div>
        )}
        <div className="form-group">
          <label>Supplier Name *</label>
          <input className="form-control" placeholder="e.g. Pak Relief Supplies Pvt Ltd"
            value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Remarks</label>
          <textarea className="form-control" rows={2} placeholder="Optional notes for approver…"
            value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
        </div>
      </Modal>

      {/* ── Reject Modal ───────────────────────────────────── */}
      <Modal isOpen={showReject} onClose={() => setShowReject(false)} title="Reject Procurement"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleReject} disabled={submitting}>
              {submitting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </>
        }>
        <div className="form-group">
          <label>Rejection Reason</label>
          <textarea className="form-control" rows={3} placeholder="Optional — reason for rejection…"
            value={rejectNotes} onChange={e => setRejectN(e.target.value)} />
        </div>
        <div style={{
          padding: '10px 14px', background: 'var(--danger-subtle)', borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem', color: '#ef4444', marginTop: 8
        }}>
          ⚠️ This action will mark the procurement as Inactive and cannot be undone.
        </div>
      </Modal>
    </div>
  );
}
