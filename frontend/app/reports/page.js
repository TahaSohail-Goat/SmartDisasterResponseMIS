'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBadgeClass, fmt } from '../lib/utils';
import Modal from '../components/Modal';

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Active', 'Pending', 'Completed', 'Inactive'];
const TYPES = ['Flood', 'Earthquake', 'Fire', 'Heatwave', 'Landslide', 'Cyclone', 'Drought', 'Other'];

export default function ReportsPage() {
  const { hasRole } = useAuth();
  const toast = useToast();

  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSev, setFSev] = useState('');
  const [filterStat, setFStat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedReport, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSub] = useState(false);
  const [form, setForm] = useState({
    disaster_event_id: '', location: '', latitude: '', longitude: '',
    disaster_type: '', severity_level: 'High', description: '',
  });

  const canSubmit = hasRole('Citizen');
  const canUpdateStatus = hasRole('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSev) params.append('severity', filterSev);
      if (filterStat) params.append('status', filterStat);
      const [rp, ev] = await Promise.all([
        api.get(`/api/reports${params.toString() ? '?' + params : ''}`),
        api.get('/api/events'),
      ]);
      setReports(rp);
      setEvents(ev.filter(e => e.status === 'Active'));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [filterSev, filterStat]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = reports.filter(r =>
    !search ||
    r.location?.toLowerCase().includes(search.toLowerCase()) ||
    r.citizen_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.event_name?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    const { disaster_event_id, location, disaster_type, severity_level, description } = form;
    if (!disaster_event_id || !location || !disaster_type || !severity_level || !description) {
      toast.error('All required fields must be filled'); return;
    }
    setSub(true);
    try {
      await api.post('/api/reports', {
        ...form,
        latitude: parseFloat(form.latitude) || 0,
        longitude: parseFloat(form.longitude) || 0,
        disaster_event_id: parseInt(form.disaster_event_id),
      });
      toast.success('Emergency report submitted!');
      setShowModal(false);
      setForm({ disaster_event_id: '', location: '', latitude: '', longitude: '', disaster_type: '', severity_level: 'High', description: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  async function handleStatusUpdate() {
    if (!newStatus) { toast.error('Select a status'); return; }
    setSub(true);
    try {
      await api.patch(`/api/reports/${selectedReport.report_id}/status`, { status: newStatus });
      toast.success('Report status updated');
      setShowStatusModal(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>🚨 Emergency Reports</h1>
          <p>Track all emergency reports submitted by citizens</p>
        </div>
        {canSubmit && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Submit Report</button>
        )}
      </div>

      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search location, citizen…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 220 }} />
        <select className="form-control" value={filterSev} onChange={e => setFSev(e.target.value)}>
          <option value="">All Severities</option>
          {SEVERITIES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-control" value={filterStat} onChange={e => setFStat(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Reports ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Critical', 'High', 'Active'].map(label => {
              const val = label === 'Active'
                ? reports.filter(r => r.status === 'Active').length
                : reports.filter(r => r.severity_level === label).length;
              const color = label === 'Critical' ? '#ef4444' : label === 'High' ? '#f97316' : '#3b82f6';
              return (
                <span key={label} style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)',
                  background: color + '20', color, fontSize: '0.75rem', fontWeight: 600
                }}>
                  {val} {label}
                </span>
              );
            })}
          </div>
        </div>

        {loading
          ? <div className="loading-container"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">🚨</div><p>No reports found</p></div>
            : <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Location</th><th>Citizen</th><th>Event</th><th>Type</th>
                    <th>Severity</th><th>Status</th><th>Teams</th><th>Time</th>
                    {canUpdateStatus && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.report_id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.location}</div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}
                          title={r.description}>
                          {r.description?.slice(0, 50)}{r.description?.length > 50 ? '…' : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <div>{r.citizen_name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{r.citizen_phone}</div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.event_name}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.disaster_type}</td>
                      <td><span className={getBadgeClass(r.severity_level)}>{r.severity_level}</span></td>
                      <td><span className={getBadgeClass(r.status)}>{r.status}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-full)',
                          background: r.teams_assigned > 0 ? 'var(--info-subtle)' : 'var(--bg-elevated)',
                          color: r.teams_assigned > 0 ? 'var(--info)' : 'var(--text-muted)',
                          fontSize: '0.75rem', fontWeight: 600
                        }}>
                          {r.teams_assigned}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(r.report_time)}</td>
                      {canUpdateStatus && (
                        <td>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => { setSelected(r); setNewStatus(r.status); setShowStatusModal(true); }}>
                            Update
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Submit Report Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Submit Emergency Report"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </>
        }>
        <div className="form-group">
          <label>Disaster Event *</label>
          <select className="form-control" value={form.disaster_event_id}
            onChange={e => setForm({ ...form, disaster_event_id: e.target.value })}>
            <option value="">Select active event…</option>
            {events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Location *</label>
          <input className="form-control" placeholder="e.g. Sukkur Barrage Area"
            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Latitude</label>
            <input className="form-control" type="number" step="any" placeholder="27.7054"
              value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Longitude</label>
            <input className="form-control" type="number" step="any" placeholder="68.8572"
              value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Disaster Type *</label>
            <select className="form-control" value={form.disaster_type}
              onChange={e => setForm({ ...form, disaster_type: e.target.value })}>
              <option value="">Select…</option>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Severity *</label>
            <select className="form-control" value={form.severity_level}
              onChange={e => setForm({ ...form, severity_level: e.target.value })}>
              {SEVERITIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea className="form-control" rows={3} placeholder="Describe the emergency situation…"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Report Status"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={submitting}>
              {submitting ? 'Saving…' : 'Update Status'}
            </button>
          </>
        }>
        {selectedReport && (
          <>
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedReport.location}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{selectedReport.description}</div>
            </div>
            <div className="form-group">
              <label>New Status</label>
              <select className="form-control" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
