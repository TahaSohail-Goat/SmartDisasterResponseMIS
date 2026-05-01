'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBadgeClass, fmt } from '../lib/utils';
import Modal from '../components/Modal';

export default function TeamsPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const canAssign = hasRole('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator');

  const [teams, setTeams] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFS] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [submitting, setSub] = useState(false);
  const [form, setForm] = useState({ rescue_team_id: '', report_id: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tm, rp] = await Promise.all([
        api.get('/api/teams'),
        api.get('/api/reports?status=Active'),
      ]);
      setTeams(tm);
      setReports(rp);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = teams.filter(t => {
    const matchSearch = !search ||
      t.team_name.toLowerCase().includes(search.toLowerCase()) ||
      t.current_location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || t.availability_status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function handleAssign(e) {
    e.preventDefault();
    if (!form.rescue_team_id || !form.report_id) {
      toast.error('Team and report are required'); return;
    }
    setSub(true);
    try {
      await api.post('/api/teams/assign', {
        rescue_team_id: parseInt(form.rescue_team_id),
        report_id: parseInt(form.report_id),
        notes: form.notes || null,
      });
      toast.success('Team assigned successfully!');
      setShowAssign(false);
      setForm({ rescue_team_id: '', report_id: '', notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  async function handleMarkOnScene(teamId) {
    try {
      await api.patch(`/api/teams/${teamId}/on-scene`);
      toast.success('Team marked as On-Scene (Busy)');
      load();
    } catch (err) { toast.error(err.message); }
  }

  const STATUS_COLORS = {
    Available: '#10b981', Busy: '#ef4444', Assigned: '#3b82f6', Completed: '#8b95a8',
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>🚁 Rescue Teams</h1>
          <p>Monitor team availability and manage field assignments</p>
        </div>
        {canAssign && (
          <button className="btn btn-primary" onClick={() => setShowAssign(true)}>+ Assign Team</button>
        )}
      </div>

      {/* Lifecycle info banner */}
      <div style={{
        padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)', marginBottom: 20, display: 'flex',
        alignItems: 'center', gap: 12, fontSize: '0.8rem', color: 'var(--text-secondary)',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Lifecycle:</span>
        <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Available</span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <span style={{ color: '#3b82f6', fontWeight: 600 }}>🔵 Assigned</span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 Busy (On-Scene)</span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Available</span>
      </div>

      {/* Status summary cards */}
      <div className="stat-grid">
        {['Available', 'Busy', 'Assigned', 'Completed'].map(s => {
          const count = teams.filter(t => t.availability_status === s).length;
          const color = STATUS_COLORS[s];
          return (
            <div key={s} className="stat-card" style={{ cursor: 'pointer' }}
              onClick={() => setFS(filterStatus === s ? '' : s)}>
              <div className="stat-icon" style={{ background: color + '20', fontSize: '1.3rem' }}>
                {s === 'Available' ? '✅' : s === 'Busy' ? '🔴' : s === 'Assigned' ? '🔵' : '✔️'}
              </div>
              <div className="stat-info">
                <div className="label">{s}</div>
                <div className="value" style={{ color }}>{count}</div>
              </div>
              {filterStatus === s && <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: color }} />}
            </div>
          );
        })}
      </div>

      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search teams…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 220 }} />
        <select className="form-control" value={filterStatus} onChange={e => setFS(e.target.value)}>
          <option value="">All Statuses</option>
          {['Available', 'Busy', 'Assigned', 'Completed'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Teams ({filtered.length})</h3>
        </div>
        {loading
          ? <div className="loading-container"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">🚁</div><p>No teams found</p></div>
            : <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Team Name</th><th>Type</th><th>Location</th>
                    <th>Status</th><th>Size</th><th>Contact</th>
                    {canAssign && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.team_id}>
                      <td style={{ fontWeight: 600 }}>{t.team_name}</td>
                      <td>
                        <span style={{
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          background: t.team_type === 'Medical' ? '#3b82f620' : t.team_type === 'Fire' ? '#f9731620' : '#0ea5e920',
                          color: t.team_type === 'Medical' ? '#3b82f6' : t.team_type === 'Fire' ? '#f97316' : '#0ea5e9',
                          fontSize: '0.75rem', fontWeight: 600,
                        }}>{t.team_type}</span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t.current_location}</td>
                      <td><span className={getBadgeClass(t.availability_status)}>{t.availability_status}</span></td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.team_size}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> members</span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t.contact_number}</td>
                      {canAssign && (
                        <td>
                          {t.availability_status === 'Assigned' && (
                            <button className="btn btn-sm" onClick={() => handleMarkOnScene(t.team_id)}
                              style={{
                                background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440',
                                fontSize: '0.73rem',
                              }}>
                              🔴 Mark On-Scene
                            </button>
                          )}
                          {t.availability_status === 'Available' && (
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Ready</span>
                          )}
                          {t.availability_status === 'Busy' && (
                            <span style={{ fontSize: '0.73rem', color: '#ef4444' }}>⏳ Working</span>
                          )}
                          {t.availability_status === 'Completed' && (
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Done</span>
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

      {/* Assign Modal */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Team to Report"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAssign(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAssign} disabled={submitting}>
              {submitting ? 'Assigning…' : 'Assign Team'}
            </button>
          </>
        }>
        <div style={{
          padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--info-subtle)',
          color: 'var(--info)', fontSize: '0.82rem', marginBottom: 16, display: 'flex', gap: 8
        }}>
          ℹ️ Only Available teams can be assigned. Assigned/Busy teams will be rejected.
        </div>
        <div className="form-group">
          <label>Select Team *</label>
          <select className="form-control" value={form.rescue_team_id}
            onChange={e => setForm({ ...form, rescue_team_id: e.target.value })}>
            <option value="">Choose a team…</option>
            {teams.filter(t => t.availability_status === 'Available').map(t => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_name} ({t.team_type}) — {t.current_location}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Select Active Report *</label>
          <select className="form-control" value={form.report_id}
            onChange={e => setForm({ ...form, report_id: e.target.value })}>
            <option value="">Choose a report…</option>
            {reports.map(r => (
              <option key={r.report_id} value={r.report_id}>
                [{r.severity_level}] {r.location} — {r.citizen_name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea className="form-control" rows={2} placeholder="Any special instructions…"
            value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
