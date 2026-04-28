'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBadgeClass, fmt, fmtDate } from '../lib/utils';
import Modal from '../components/Modal';

const TYPES = ['Flood', 'Earthquake', 'Fire', 'Heatwave', 'Landslide', 'Cyclone', 'Drought', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Active', 'Pending', 'Completed', 'Inactive'];

export default function EventsPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const canCreate = hasRole('System_Admin', 'Disaster_Coordinator');

  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFS]     = useState('');
  const [filterType, setFT]       = useState('');
  const [search, setSearch]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSub]      = useState(false);
  const [form, setForm]           = useState({
    event_name: '', disaster_type: '', location: '',
    severity_level: 'Medium', description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType)   params.append('type',   filterType);
      const data = await api.get(`/api/events${params.toString() ? '?' + params : ''}`);
      setEvents(data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const filtered = events.filter(e =>
    !search || e.event_name.toLowerCase().includes(search.toLowerCase()) ||
    e.location.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    const { event_name, disaster_type, location, severity_level, description } = form;
    if (!event_name || !disaster_type || !location || !severity_level || !description) {
      toast.error('All fields are required'); return;
    }
    setSub(true);
    try {
      await api.post('/api/events', form);
      toast.success('Disaster event created!');
      setShowModal(false);
      setForm({ event_name: '', disaster_type: '', location: '', severity_level: 'Medium', description: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  async function handleClose(id) {
    if (!confirm('Close this disaster event? This will mark it as Completed.')) return;
    try {
      await api.patch(`/api/events/${id}/close`, {});
      toast.success('Event closed successfully');
      load();
    } catch (err) { toast.error(err.message); }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>🌪️ Disaster Events</h1>
          <p>Monitor and manage active disaster events across the country</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Event</button>
        )}
      </div>

      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search events…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 220 }} />
        <select className="form-control" value={filterStatus} onChange={e => setFS(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="form-control" value={filterType} onChange={e => setFT(e.target.value)}>
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Events ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Active','Critical','Completed'].map(label => {
              const val = label === 'Critical'
                ? events.filter(e => e.severity_level === 'Critical').length
                : events.filter(e => e.status === label).length;
              const color = label === 'Active' ? '#3b82f6' : label === 'Critical' ? '#ef4444' : '#10b981';
              return (
                <span key={label} style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)',
                  background: color + '20', color, fontSize: '0.75rem', fontWeight: 600 }}>
                  {val} {label}
                </span>
              );
            })}
          </div>
        </div>
        {loading
          ? <div className="loading-container"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">🌪️</div><p>No events found</p></div>
            : <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Event Name</th><th>Type</th><th>Location</th>
                    <th>Severity</th><th>Status</th><th>Start</th><th>End</th>
                    {canCreate && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ev => (
                    <tr key={ev.event_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ev.event_name}</div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {ev.description?.slice(0, 55)}{ev.description?.length > 55 ? '…' : ''}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{ev.disaster_type}</td>
                      <td style={{ fontSize: '0.82rem' }}>{ev.location}</td>
                      <td><span className={getBadgeClass(ev.severity_level)}>{ev.severity_level}</span></td>
                      <td><span className={getBadgeClass(ev.status)}>{ev.status}</span></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(ev.start_date)}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {ev.end_date ? fmtDate(ev.end_date) : <em style={{ color: 'var(--text-muted)' }}>Ongoing</em>}
                      </td>
                      {canCreate && (
                        <td>
                          {ev.status === 'Active' && hasRole('System_Admin') && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleClose(ev.event_id)}>Close</button>
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Disaster Event"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Event'}
            </button>
          </>
        }>
        <div className="form-group">
          <label>Event Name *</label>
          <input className="form-control" placeholder="e.g. Sindh Flood 2025"
            value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Disaster Type *</label>
            <select className="form-control" value={form.disaster_type}
              onChange={e => setForm({ ...form, disaster_type: e.target.value })}>
              <option value="">Select type…</option>
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
          <label>Location *</label>
          <input className="form-control" placeholder="e.g. Sindh, Pakistan"
            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea className="form-control" rows={3} placeholder="Describe the disaster event…"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
