'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getBadgeClass, fmt } from '../lib/utils';
import Modal from '../components/Modal';

const ROLE_COLORS = {
  System_Admin:         '#6366f1',
  Disaster_Coordinator: '#f97316',
  Rescue_Operator:      '#10b981',
  Warehouse_Manager:    '#3b82f6',
  Finance_Officer:      '#f59e0b',
  Citizen:              '#8b5cf6',
};

export default function AdminPage() {
  const { hasRole } = useAuth();
  const toast = useToast();

  const [users, setUsers]       = useState([]);
  const [roles, setRoles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRF]    = useState('');
  const [activeTab, setTab]     = useState('users');

  // Create user
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '', password: '', email: '', phone: '', role_id: '', is_active: true,
  });

  // Edit user
  const [showEdit, setShowEdit]     = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [editForm, setEditForm]     = useState({
    username: '', email: '', phone: '', role_id: '', is_active: true,
  });

  // Reset password
  const [showReset, setShowReset]   = useState(false);
  const [resetUserId, setResetId]   = useState(null);
  const [resetPass, setResetPass]   = useState('');

  const [submitting, setSub]        = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/roles'),
      ]);
      setUsers(u);
      setRoles(r);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Filtered users ─────────────────────────────────────── */
  const filtered = users.filter(u => {
    if (roleFilter && u.role_id !== parseInt(roleFilter)) return false;
    if (search) {
      const s = search.toLowerCase();
      return u.username.toLowerCase().includes(s) ||
             u.email.toLowerCase().includes(s) ||
             (u.role_name || '').toLowerCase().includes(s);
    }
    return true;
  });

  /* ── Create User ────────────────────────────────────────── */
  async function handleCreate(e) {
    e.preventDefault();
    const { username, password, email, phone, role_id } = createForm;
    if (!username || !password || !email || !phone || !role_id) {
      toast.error('All fields are required'); return;
    }
    setSub(true);
    try {
      await api.post('/api/admin/users', {
        ...createForm,
        role_id: parseInt(createForm.role_id),
      });
      toast.success('User created successfully!');
      setShowCreate(false);
      setCreateForm({ username: '', password: '', email: '', phone: '', role_id: '', is_active: true });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  /* ── Edit User ──────────────────────────────────────────── */
  function openEdit(u) {
    setEditUser(u);
    setEditForm({
      username: u.username, email: u.email,
      phone: u.phone, role_id: String(u.role_id), is_active: u.is_active,
    });
    setShowEdit(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setSub(true);
    try {
      await api.patch(`/api/admin/users/${editUser.user_id}`, {
        ...editForm,
        role_id: parseInt(editForm.role_id),
        is_active: editForm.is_active,
      });
      toast.success('User updated');
      setShowEdit(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  /* ── Reset Password ─────────────────────────────────────── */
  function openReset(userId) {
    setResetId(userId);
    setResetPass('');
    setShowReset(true);
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!resetPass || resetPass.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setSub(true);
    try {
      await api.patch(`/api/admin/users/${resetUserId}/password`, { password: resetPass });
      toast.success('Password reset successfully');
      setShowReset(false);
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  /* ── Stats ──────────────────────────────────────────────── */
  const totalUsers  = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const roleCounts  = {};
  users.forEach(u => { roleCounts[u.role_name] = (roleCounts[u.role_name] || 0) + 1; });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>👥 Administration</h1>
          <p>Manage system users, roles, and access control</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create User</button>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────── */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-card fade-in-up">
          <div className="stat-icon" style={{ background: '#6366f120' }}>👥</div>
          <div className="stat-info">
            <div className="label">Total Users</div>
            <div className="value" style={{ color: '#6366f1' }}>{totalUsers}</div>
          </div>
        </div>
        <div className="stat-card fade-in-up stagger-1">
          <div className="stat-icon" style={{ background: '#10b98120' }}>✅</div>
          <div className="stat-info">
            <div className="label">Active</div>
            <div className="value" style={{ color: '#10b981' }}>{activeUsers}</div>
          </div>
        </div>
        <div className="stat-card fade-in-up stagger-2">
          <div className="stat-icon" style={{ background: '#ef444420' }}>🚫</div>
          <div className="stat-info">
            <div className="label">Inactive</div>
            <div className="value" style={{ color: '#ef4444' }}>{totalUsers - activeUsers}</div>
          </div>
        </div>
        <div className="stat-card fade-in-up stagger-3">
          <div className="stat-icon" style={{ background: '#f59e0b20' }}>🔐</div>
          <div className="stat-info">
            <div className="label">Roles</div>
            <div className="value" style={{ color: '#f59e0b' }}>{roles.length}</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-card)',
        padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', width: 'fit-content' }}>
        {[['users','👥 Users'], ['roles','🔐 Roles']].map(([id, label]) => (
          <button key={id} className={activeTab === id ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── Users Tab ──────────────────────────────────────── */}
      {activeTab === 'users' && (
        <>
          <div className="filters-bar">
            <input className="form-control" placeholder="🔍 Search users…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ minWidth: 220 }} />
            <select className="form-control" value={roleFilter} onChange={e => setRF(e.target.value)}>
              <option value="">All Roles</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name.replace(/_/g, ' ')}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
          </div>

          <div className="table-container">
            <div className="table-header">
              <h3>Users ({filtered.length})</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(roleCounts).map(([role, count]) => (
                  <span key={role} style={{
                    padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 600,
                    background: (ROLE_COLORS[role] || '#8b95a8') + '20', color: ROLE_COLORS[role] || '#8b95a8',
                  }}>{count} {role.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
            {loading
              ? <div className="loading-container"><div className="spinner" /></div>
              : filtered.length === 0
                ? <div className="empty-state"><div className="icon">👤</div><p>No users found</p></div>
                : <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(u => (
                          <tr key={u.user_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                                  background: ROLE_COLORS[u.role_name] || '#8b95a8',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                                }}>{(u.username || 'U')[0].toUpperCase()}</div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.username}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {u.user_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{u.phone}</td>
                            <td>
                              <span style={{
                                padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 600,
                                background: (ROLE_COLORS[u.role_name] || '#8b95a8') + '20',
                                color: ROLE_COLORS[u.role_name] || '#8b95a8',
                              }}>{(u.role_name || '').replace(/_/g, ' ')}</span>
                            </td>
                            <td>
                              <span className={u.is_active ? 'badge badge-available' : 'badge badge-inactive'}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(u.created_at)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => openReset(u.user_id)} title="Reset Password">🔑</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            }
          </div>
        </>
      )}

      {/* ── Roles Tab ──────────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="table-container">
          <div className="table-header"><h3>System Roles ({roles.length})</h3></div>
          {loading
            ? <div className="loading-container"><div className="spinner" /></div>
            : <div className="table-wrapper">
                <table>
                  <thead><tr><th>ID</th><th>Role</th><th>Description</th><th>Users</th><th>Created</th></tr></thead>
                  <tbody>
                    {roles.map(r => (
                      <tr key={r.role_id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{r.role_id}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 600,
                            background: (ROLE_COLORS[r.role_name] || '#8b95a8') + '20',
                            color: ROLE_COLORS[r.role_name] || '#8b95a8',
                          }}>{r.role_name.replace(/_/g, ' ')}</span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 320 }}>{r.description}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {roleCounts[r.role_name] || 0}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── Create User Modal ──────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New User"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </>
        }>
        <div className="form-row">
          <div className="form-group">
            <label>Username *</label>
            <input className="form-control" placeholder="e.g. john_doe"
              value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input className="form-control" type="password" placeholder="Min 6 characters"
              value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Email *</label>
            <input className="form-control" type="email" placeholder="user@example.com"
              value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input className="form-control" placeholder="03XX-XXXXXXX"
              value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Role *</label>
            <select className="form-control" value={createForm.role_id}
              onChange={e => setCreateForm({ ...createForm, role_id: e.target.value })}>
              <option value="">Select role…</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={createForm.is_active ? 'true' : 'false'}
              onChange={e => setCreateForm({ ...createForm, is_active: e.target.value === 'true' })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Edit User Modal ────────────────────────────────── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)}
        title={`Edit User — ${editUser?.username || ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }>
        <div className="form-row">
          <div className="form-group">
            <label>Username</label>
            <input className="form-control" value={editForm.username}
              onChange={e => setEditForm({ ...editForm, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-control" value={editForm.phone}
              onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Email</label>
          <input className="form-control" type="email" value={editForm.email}
            onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Role</label>
            <select className="form-control" value={editForm.role_id}
              onChange={e => setEditForm({ ...editForm, role_id: e.target.value })}>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-control" value={editForm.is_active ? 'true' : 'false'}
              onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Reset Password Modal ───────────────────────────── */}
      <Modal isOpen={showReset} onClose={() => setShowReset(false)} title="Reset Password"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowReset(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleReset} disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </>
        }>
        <div className="form-group">
          <label>New Password *</label>
          <input className="form-control" type="password" placeholder="Enter new password (min 6 chars)"
            value={resetPass} onChange={e => setResetPass(e.target.value)} />
        </div>
        <div style={{ padding: '10px 14px', background: 'var(--warning-subtle)', borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem', color: '#f59e0b', marginTop: 8 }}>
          ⚠️ This will immediately change the user's password. They will need to log in again with the new password.
        </div>
      </Modal>
    </div>
  );
}
