'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const STATUS_COLORS = { Pending: '#f97316', Approved: '#10b981', Rejected: '#ef4444' };

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ApprovalsPage() {
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Pending');
  const [deciding, setDeciding] = useState(null);

  const canDecide = hasRole('System_Admin', 'Disaster_Coordinator', 'Finance_Officer', 'Warehouse_Manager');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter ? `?status=${filter}` : '';
      const data = await api.get(`/api/admin/approvals${qs}`);
      setRequests(data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function decide(id, status) {
    setDeciding(id);
    try {
      await api.patch(`/api/admin/approvals/${id}`, { status });
      toast.success(`Request ${status}!`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setDeciding(null); }
  }

  const counts = {
    Pending:  requests.filter(r => r.status === 'Pending').length,
    Approved: requests.filter(r => r.status === 'Approved').length,
    Rejected: requests.filter(r => r.status === 'Rejected').length,
  };

  return (
    <div>
      <div className="page-header">
        <h1>✅ Approval Workflow</h1>
        <p>Review and action pending approval requests — resource distribution, deployments, financial approvals</p>
      </div>

      {/* Separation of duties notice */}
      <div style={{
        padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)', marginBottom: 20, display: 'flex',
        alignItems: 'center', gap: 10, fontSize: '0.8rem', color: 'var(--text-secondary)',
      }}>
        <span style={{ fontSize: '1rem' }}>🔒</span>
        <span><strong style={{ color: 'var(--text-primary)' }}>Separation of Duties:</strong> You cannot approve or reject your own requests. A different authorized user must review them.</span>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['Pending', 'Approved', 'Rejected', ''].map(s => (
          <button
            key={s || 'all'}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
            style={{ position: 'relative' }}
          >
            {s || 'All'}
            {s === 'Pending' && counts.Pending > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: '#ef4444', color: '#fff', borderRadius: '50%',
                width: 18, height: 18, fontSize: '0.65rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{counts.Pending}</span>
            )}
          </button>
        ))}
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={load}>↺ Refresh</button>
      </div>

      {loading
        ? <div className="loading-container"><div className="spinner" /></div>
        : requests.length === 0
          ? (
            <div className="empty-state">
              <div className="icon">{filter === 'Pending' ? '🎉' : '📭'}</div>
              <p>{filter === 'Pending' ? 'No pending requests — all clear!' : 'No requests found'}</p>
            </div>
          )
          : (
            <div className="table-container">
              <div className="table-header">
                <h3>
                  {filter || 'All'} Requests
                  <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    ({requests.length})
                  </span>
                </h3>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Requested By</th>
                      <th>Role</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Decided By</th>
                      <th>Decided At</th>
                      <th>Notes</th>
                      {canDecide && filter === 'Pending' && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => {
                      const isOwnRequest = user && r.requested_by === user.user_id;
                      return (
                        <tr key={r.request_id} style={isOwnRequest && r.status === 'Pending' ? { background: 'rgba(249, 115, 22, 0.04)' } : {}}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>#{r.request_id}</td>
                          <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.request_type}</td>
                          <td>
                            {r.requester_name}
                            {isOwnRequest && (
                              <span style={{
                                marginLeft: 6, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                background: '#f9731620', color: '#f97316', fontSize: '0.65rem', fontWeight: 700,
                              }}>YOU</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {(r.requester_role || '').replace(/_/g, ' ')}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(r.request_time)}</td>
                          <td>
                            <span style={{
                              padding: '3px 10px', borderRadius: 'var(--radius-full)',
                              fontSize: '0.72rem', fontWeight: 700,
                              background: (STATUS_COLORS[r.status] || '#0ea5e9') + '20',
                              color: STATUS_COLORS[r.status] || '#0ea5e9',
                            }}>{r.status}</span>
                          </td>
                          <td style={{ fontSize: '0.78rem' }}>{r.approver_name || '—'}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(r.decision_time)}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={r.notes}>{r.notes || '—'}</td>
                          {canDecide && filter === 'Pending' && (
                            <td>
                              {isOwnRequest ? (
                                <span style={{
                                  fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic',
                                }}>🔒 Own request</span>
                              ) : (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    disabled={deciding === r.request_id}
                                    onClick={() => decide(r.request_id, 'Approved')}
                                    style={{ background: '#10b981', fontSize: '0.72rem', padding: '4px 10px' }}
                                  >
                                    {deciding === r.request_id ? '…' : '✓ Approve'}
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={deciding === r.request_id}
                                    onClick={() => decide(r.request_id, 'Rejected')}
                                    style={{ color: '#ef4444', borderColor: '#ef4444', fontSize: '0.72rem', padding: '4px 10px' }}
                                  >
                                    ✗ Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
      }
    </div>
  );
}
