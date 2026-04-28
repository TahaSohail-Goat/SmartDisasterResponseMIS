'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBadgeClass } from '../lib/utils';
import Modal from '../components/Modal';

export default function InventoryPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const canAllocate = hasRole('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator');

  const [inventory, setInventory] = useState([]);
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterAlert, setFA]      = useState('');
  const [showAlloc, setShowAlloc] = useState(false);
  const [submitting, setSub]      = useState(false);
  const [form, setForm]           = useState({ inventory_id: '', report_id: '', allocated_quantity: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, rp] = await Promise.all([
        api.get('/api/inventory'),
        api.get('/api/reports?status=Active'),
      ]);
      setInventory(inv);
      setReports(rp);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = inventory.filter(item => {
    const matchSearch = !search ||
      item.resource_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.warehouse_name?.toLowerCase().includes(search.toLowerCase());
    const isLow = item.stock_alert === 'LOW STOCK' || item.stock_alert === 'OUT OF STOCK';
    const matchAlert = !filterAlert ||
      (filterAlert === 'low' && isLow) ||
      (filterAlert === 'ok' && !isLow);
    return matchSearch && matchAlert;
  });

  async function handleAllocate(e) {
    e.preventDefault();
    const { inventory_id, report_id, allocated_quantity } = form;
    if (!inventory_id || !report_id || !allocated_quantity) {
      toast.error('All fields are required'); return;
    }
    const qty = parseInt(allocated_quantity);
    if (isNaN(qty) || qty <= 0) { toast.error('Quantity must be a positive number'); return; }

    const selectedItem = inventory.find(i => i.inventory_id === parseInt(inventory_id));
    if (selectedItem && qty > selectedItem.current_stock) {
      toast.error(`Insufficient stock. Available: ${selectedItem.current_stock}`); return;
    }

    setSub(true);
    try {
      await api.post('/api/inventory/allocate', {
        inventory_id: parseInt(inventory_id),
        report_id: parseInt(report_id),
        allocated_quantity: qty,
      });
      toast.success('Resource allocation created — pending approval');
      setShowAlloc(false);
      setForm({ inventory_id: '', report_id: '', allocated_quantity: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  const lowStockCount = inventory.filter(i => i.stock_alert === 'LOW STOCK' || i.stock_alert === 'OUT OF STOCK').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>📦 Warehouse Inventory</h1>
          <p>Monitor stock levels and allocate resources to active reports</p>
        </div>
        {canAllocate && (
          <button className="btn btn-primary" onClick={() => setShowAlloc(true)}>+ Allocate Resource</button>
        )}
      </div>

      {lowStockCount > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 20,
          background: 'var(--warning-subtle)', border: '1px solid rgba(245,158,11,0.3)',
          color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          ⚠️ <strong>{lowStockCount} item{lowStockCount > 1 ? 's' : ''}</strong> below threshold — restock required
        </div>
      )}

      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search resource or warehouse…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select className="form-control" value={filterAlert} onChange={e => setFA(e.target.value)}>
          <option value="">All Stock Levels</option>
          <option value="low">⚠️ Low Stock Only</option>
          <option value="ok">✅ Normal Stock Only</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Inventory ({filtered.length} items)</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: 'var(--warning-subtle)', color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}>
              {lowStockCount} Low Stock
            </span>
            <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: 'var(--success-subtle)', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
              {inventory.length - lowStockCount} Normal
            </span>
          </div>
        </div>

        {loading
          ? <div className="loading-container"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">📦</div><p>No inventory records found</p></div>
            : <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Resource</th><th>Type</th><th>Warehouse</th>
                    <th>Current Stock</th><th>Threshold</th><th>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isLow = item.stock_alert === 'LOW STOCK' || item.stock_alert === 'OUT OF STOCK';
                    const isOut = item.stock_alert === 'OUT OF STOCK';
                    const pct = item.threshold_level > 0
                      ? Math.min(100, Math.round((item.current_stock / item.threshold_level) * 100))
                      : 100;
                    const barColor = isOut ? '#7f1d1d' : isLow ? '#ef4444' : pct < 150 ? '#f59e0b' : '#10b981';
                    return (
                      <tr key={item.inventory_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.resource_name}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{item.unit_of_measure}</div>
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.73rem', fontWeight: 600,
                            background: item.resource_type === 'Food' ? '#10b98120' : item.resource_type === 'Medicine' ? '#3b82f620' : item.resource_type === 'Water' ? '#06b6d420' : '#8b5cf620',
                            color: item.resource_type === 'Food' ? '#10b981' : item.resource_type === 'Medicine' ? '#3b82f6' : item.resource_type === 'Water' ? '#06b6d4' : '#8b5cf6',
                          }}>{item.resource_type}</span>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{item.warehouse_name}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: item.stock_alert ? 'var(--danger)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {item.current_stock?.toLocaleString()}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {item.threshold_level?.toLocaleString()}
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600,
                                background: isOut ? 'rgba(127,29,29,0.2)' : isLow ? 'var(--danger-subtle)' : 'var(--success-subtle)',
                                color: isOut ? '#fca5a5' : isLow ? 'var(--danger)' : 'var(--success)' }}>
                                {isOut ? '🚫 Out of Stock' : isLow ? '⚠ Low Stock' : '✓ OK'}
                              </span>
                              {item.pending_procurement_qty > 0 && (
                                <span style={{ fontSize: '0.65rem', color: '#3b82f6' }}>+{item.pending_procurement_qty} incoming</span>
                              )}
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: Math.min(pct, 100) + '%', background: barColor }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Allocate Modal */}
      <Modal isOpen={showAlloc} onClose={() => setShowAlloc(false)} title="Allocate Resource"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAlloc(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAllocate} disabled={submitting}>
              {submitting ? 'Allocating…' : 'Allocate'}
            </button>
          </>
        }>
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-subtle)',
          color: 'var(--info)', fontSize: '0.82rem', marginBottom: 16 }}>
          ℹ️ Allocation will be created with Pending status and requires approval.
        </div>
        <div className="form-group">
          <label>Resource / Inventory *</label>
          <select className="form-control" value={form.inventory_id}
            onChange={e => setForm({ ...form, inventory_id: e.target.value })}>
            <option value="">Select resource…</option>
            {inventory.filter(i => i.current_stock > 0).map(i => (
              <option key={i.inventory_id} value={i.inventory_id}>
                {i.resource_name} @ {i.warehouse_name} (Stock: {i.current_stock?.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Active Report *</label>
          <select className="form-control" value={form.report_id}
            onChange={e => setForm({ ...form, report_id: e.target.value })}>
            <option value="">Select report…</option>
            {reports.map(r => (
              <option key={r.report_id} value={r.report_id}>
                [{r.severity_level}] {r.location}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Quantity *</label>
          <input className="form-control" type="number" min="1" placeholder="e.g. 100"
            value={form.allocated_quantity} onChange={e => setForm({ ...form, allocated_quantity: e.target.value })} />
          {form.inventory_id && (() => {
            const item = inventory.find(i => i.inventory_id === parseInt(form.inventory_id));
            return item ? (
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Available: {item.current_stock?.toLocaleString()} {item.unit_of_measure}
              </div>
            ) : null;
          })()}
        </div>
      </Modal>
    </div>
  );
}
