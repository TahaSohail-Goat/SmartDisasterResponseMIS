'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ACTION_COLORS = {
  INSERT: '#10b981',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
};

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AuditPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFA] = useState('');
  const [filterTable, setFT] = useState('');

  if (!hasRole('System_Admin')) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <h2>Access Restricted</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Audit log is only visible to System Administrators.</p>
      </div>
    );
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/audit');
      setLogs(data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tables = [...new Set(logs.map(l => l.table_name))].sort();

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.actor?.toLowerCase().includes(search.toLowerCase()) ||
      l.table_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.old_value?.toLowerCase().includes(search.toLowerCase()) ||
      l.new_value?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !filterAction || l.action === filterAction;
    const matchTable  = !filterTable  || l.table_name === filterTable;
    return matchSearch && matchAction && matchTable;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>🔍 Audit Log</h1>
          <p>Full traceability of all system actions — who did what, when</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>↺ Refresh</button>
      </div>

      {/* Stats bar */}
      <div className="stat-grid">
        {['INSERT','UPDATE','DELETE'].map(action => {
          const count = logs.filter(l => l.action === action).length;
          const color = ACTION_COLORS[action];
          return (
            <div key={action} className="stat-card" style={{ cursor: 'pointer' }}
              onClick={() => setFA(filterAction === action ? '' : action)}>
              <div className="stat-icon" style={{ background: color + '20', fontSize: '1.3rem' }}>
                {action === 'INSERT' ? '➕' : action === 'UPDATE' ? '✏️' : '🗑️'}
              </div>
              <div className="stat-info">
                <div className="label">{action}s</div>
                <div className="value" style={{ color }}>{count}</div>
              </div>
              {filterAction === action && (
                <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: color }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search actor, table, values…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select className="form-control" value={filterAction} onChange={e => setFA(e.target.value)}>
          <option value="">All Actions</option>
          {['INSERT','UPDATE','DELETE'].map(a => <option key={a}>{a}</option>)}
        </select>
        <select className="form-control" value={filterTable} onChange={e => setFT(e.target.value)}>
          <option value="">All Tables</option>
          {tables.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>Audit Entries ({filtered.length})</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Showing last 200 entries</span>
        </div>
        {loading
          ? <div className="loading-container"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">🔍</div><p>No audit entries found</p></div>
            : <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Table</th><th>Record</th><th>Before</th><th>After</th></tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.log_id}>
                      <td style={{ fontSize: '0.73rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmt(l.timestamp)}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.actor}</td>
                      <td style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                        {(l.actor_role || '').replace(/_/g,' ')}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 700,
                          background: (ACTION_COLORS[l.action] || '#0ea5e9') + '20',
                          color: ACTION_COLORS[l.action] || '#0ea5e9',
                        }}>{l.action}</span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{l.table_name}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.82rem', fontWeight: 600 }}>#{l.record_id}</td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={l.old_value}>
                        {l.old_value || '—'}
                      </td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={l.new_value}>
                        {l.new_value || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}
