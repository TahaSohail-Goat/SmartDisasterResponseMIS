'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { fmtMoney } from '../lib/utils';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';

/* ── Color palette ─────────────────────────────────────────── */
const SEVERITY_COLORS = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#10b981' };
const CHART_COLORS = ['#0ea5e9', '#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
const APPROVAL_COLORS = { Pending: '#f59e0b', Approved: '#10b981', Rejected: '#ef4444' };

/* ── Stat Card ─────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, sub, index = 0 }) {
  return (
    <motion.div 
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="stat-icon" style={{ background: `${color}20`, fontSize: '1.4rem' }}>{icon}</div>
      <div className="stat-info">
        <div className="label">{label}</div>
        <div className="value" style={{ color }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

/* ── Custom Tooltip ────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px', boxShadow: 'var(--shadow-lg)',
    }}>
      {label && <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: '0.78rem', color: p.color || 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span>{p.name}: <strong style={{ color: 'var(--text-primary)' }}>{typeof p.value === 'number' && p.value > 999 ? fmtMoney(p.value) : p.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

/* ── Chart Card wrapper ────────────────────────────────────── */
function ChartCard({ title, subtitle, children, className = '', index = 0 }) {
  return (
    <motion.div 
      className={`card ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + (index * 0.15), duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -2 }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const toast = useToast();
  const [overview, setOverview]     = useState(null);
  const [severity, setSeverity]     = useState([]);
  const [byLocation, setByLoc]     = useState([]);
  const [resources, setResources]   = useState([]);
  const [finByEvent, setFinByEvent] = useState([]);
  const [respTimes, setRespTimes]   = useState([]);
  const [approvals, setApprovals]   = useState([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    try {
      const [ov, sev, loc, res, fin, rt, apr] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/incident-severity'),
        api.get('/api/analytics/reports-by-location'),
        api.get('/api/analytics/resource-utilization'),
        api.get('/api/analytics/finance-by-event'),
        api.get('/api/analytics/response-times'),
        api.get('/api/analytics/approvals'),
      ]);
      setOverview(ov);
      setSeverity(sev);
      setByLoc(loc);
      setResources(res);
      setFinByEvent(fin);
      setRespTimes(rt);
      setApprovals(apr);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  /* ── Derived data ──────────────────────────────────────── */
  const severityData = severity.map(s => ({
    name: s.severity_level,
    value: s.report_count,
    fill: SEVERITY_COLORS[s.severity_level] || '#8b95a8',
  }));

  const approvalGrouped = {};
  approvals.forEach(a => {
    if (!approvalGrouped[a.request_type]) approvalGrouped[a.request_type] = {};
    approvalGrouped[a.request_type][a.status] = a.request_count;
  });
  const approvalData = Object.entries(approvalGrouped).map(([type, statuses]) => ({
    name: type.replace(/_/g, ' '),
    Pending: statuses.Pending || 0,
    Approved: statuses.Approved || 0,
    Rejected: statuses.Rejected || 0,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>📈 Analytics & Insights</h1>
        <p>Real-time operational intelligence across all disaster response dimensions</p>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────── */}
      {overview && (
        <div className="stat-grid">
          <StatCard icon="🌪️" label="Active Events"      value={overview.active_events}     color="#ef4444" sub="currently monitored" index={1} />
          <StatCard icon="🚨" label="Open Reports"        value={overview.open_reports}       color="#f97316" sub={`${overview.critical_reports} critical`} index={2} />
          <StatCard icon="🚁" label="Available Teams"     value={overview.available_teams}    color="#10b981" index={3} />
          <StatCard icon="⚠️" label="Low Stock Items"     value={overview.low_stock_items}    color="#f59e0b" sub={`${overview.pending_approvals} pending approvals`} index={4} />
        </div>
      )}

      {/* ── Finance KPIs ───────────────────────────────────── */}
      {overview && (
        <div className="stat-grid">
          <StatCard icon="💚" label="Total Donations"  value={fmtMoney(overview.total_donations)} color="#10b981" index={5} />
          <StatCard icon="💸" label="Total Spend"      value={fmtMoney(overview.total_spend)}     color="#ef4444" index={6} />
          <StatCard icon="⚖️" label="Net Balance"      value={fmtMoney((overview.total_donations || 0) - (overview.total_spend || 0))}
            color={(overview.total_donations || 0) >= (overview.total_spend || 0) ? '#0ea5e9' : '#ef4444'}
            sub={(overview.total_donations || 0) >= (overview.total_spend || 0) ? '▲ Surplus' : '▼ Deficit'} index={7} />
        </div>
      )}

      {/* ── Row 1: Severity Donut + Reports by Location ──── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Incident Severity" subtitle="Report distribution by severity level" index={1}>
          {severityData.length === 0
            ? <div className="empty-state"><p>No data</p></div>
            : <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={severityData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={3} stroke="none"
                  >
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
          }
        </ChartCard>

        <ChartCard title="Reports by Location" subtitle="Top 10 incident hotspots" index={2}>
          {byLocation.length === 0
            ? <div className="empty-state"><p>No data</p></div>
            : <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byLocation} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="location" width={140}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="report_count" name="Reports" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>
      </div>

      {/* ── Row 2: Resource Utilization + Finance ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Resource Utilization" subtitle="Allocated vs dispatched vs consumed" index={3}>
          {resources.length === 0
            ? <div className="empty-state"><p>No data</p></div>
            : <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resources} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="resource_name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{value}</span>}
                  />
                  <Bar dataKey="allocated_quantity"  name="Allocated"  fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="dispatched_quantity" name="Dispatched" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} />
                  <Bar dataKey="consumed_quantity"   name="Consumed"   fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>

        <ChartCard title="Finance by Disaster Event" subtitle="Donations vs expenses per event" index={4}>
          {finByEvent.length === 0
            ? <div className="empty-state"><p>No data</p></div>
            : <ResponsiveContainer width="100%" height={300}>
                <BarChart data={finByEvent} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="event_name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{value}</span>}
                  />
                  <Bar dataKey="total_donations"    name="Donations"    fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="approved_expenses"   name="Expenses"     fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="procurement_spend"   name="Procurement"  fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>
      </div>

      {/* ── Row 3: Response Times + Approval Status ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <ChartCard title="Response Time Analysis" subtitle="Average response minutes by event and severity" className="stagger-5">
          {respTimes.length === 0
            ? <div className="empty-state"><p>No response time data yet</p></div>
            : <div className="table-wrapper" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Severity</th>
                      <th>Avg Response</th>
                      <th>Assignments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respTimes.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, fontSize: '0.82rem' }}>{r.event_name}</td>
                        <td><span className={`badge badge-${r.severity_level?.toLowerCase()}`}>{r.severity_level}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className="progress-fill" style={{
                                width: `${Math.min((r.avg_response_minutes || 0) / 120 * 100, 100)}%`,
                                background: (r.avg_response_minutes || 0) < 30 ? '#10b981' : (r.avg_response_minutes || 0) < 60 ? '#f59e0b' : '#ef4444',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {Math.round(r.avg_response_minutes || 0)} min
                            </span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{r.assignment_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </ChartCard>

        <ChartCard title="Approval Workflow Status" subtitle="Request status breakdown by type" className="stagger-6">
          {approvalData.length === 0
            ? <div className="empty-state"><p>No approval data</p></div>
            : <ResponsiveContainer width="100%" height={280}>
                <BarChart data={approvalData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{value}</span>}
                  />
                  <Bar dataKey="Pending"  name="Pending"  fill={APPROVAL_COLORS.Pending}  radius={[4, 4, 0, 0]} barSize={18} stackId="a" />
                  <Bar dataKey="Approved" name="Approved" fill={APPROVAL_COLORS.Approved} radius={[0, 0, 0, 0]} barSize={18} stackId="a" />
                  <Bar dataKey="Rejected" name="Rejected" fill={APPROVAL_COLORS.Rejected} radius={[0, 0, 4, 4]} barSize={18} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
          }
        </ChartCard>
      </div>

      {/* ── Auto-refresh indicator ─────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
          Live — auto-refreshing every 30 seconds
        </span>
      </div>
    </div>
  );
}
