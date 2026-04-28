'use client';
import { useEffect, useState } from 'react';
import { api } from './lib/api';
import { useAuth } from './context/AuthContext';
import { getBadgeClass, fmt, fmtMoney } from './lib/utils';
import Link from 'next/link';

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="stat-card fade-in-up">
      <div className="stat-icon" style={{ background: `${color}20`, fontSize: '1.4rem' }}>{icon}</div>
      <div className="stat-info">
        <div className="label">{label}</div>
        <div className="value" style={{ color }}>{value ?? '—'}</div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const [events, setEvents]   = useState([]);
  const [reports, setReports] = useState([]);
  const [teams, setTeams]     = useState([]);
  const [loading, setLoading] = useState(true);

  const canViewTeams = hasRole('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator');

  useEffect(() => {
    Promise.all([
      api.get('/api/events'),
      api.get('/api/reports'),
      api.get('/api/teams'),
    ]).then(([ev, rp, tm]) => {
      setEvents(ev);
      setReports(rp);
      setTeams(tm);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  const activeEvents    = events.filter(e => e.status === 'Active').length;
  const criticalReports = reports.filter(r => r.severity_level === 'Critical').length;
  const availableTeams  = teams.filter(t => t.availability_status === 'Available').length;
  const busyTeams       = teams.filter(t => t.availability_status === 'Busy').length;

  const recentReports = reports.slice(0, 6);
  const recentEvents  = events.slice(0, 5);

  const roleLabel = (user?.role || '').replace(/_/g, ' ');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1>{greeting}, {user?.username} 👋</h1>
        <p>Role: <strong style={{ color: 'var(--accent-hover)' }}>{roleLabel}</strong> · {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stat Grid */}
      <div className="stat-grid">
        <StatCard icon="🌪️" label="Active Disasters" value={activeEvents}    color="#ef4444" sub={`of ${events.length} total`} />
        <StatCard icon="🚨" label="Critical Reports"  value={criticalReports} color="#f97316" sub={`of ${reports.length} total`} />
        {canViewTeams && <StatCard icon="🚁" label="Teams Available"   value={availableTeams}  color="#10b981" sub={`${busyTeams} busy`} />}
        <StatCard icon="📋" label="Total Reports"      value={reports.length}  color="#6366f1" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Active Disasters */}
        <div className="table-container fade-in-up stagger-2">
          <div className="table-header">
            <h3>🌪️ Active Disasters</h3>
            <Link href="/events" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-wrapper">
            {recentEvents.length === 0
              ? <div className="empty-state"><div className="icon">📭</div><p>No events found</p></div>
              : <table>
                <thead><tr><th>Event</th><th>Type</th><th>Severity</th><th>Status</th></tr></thead>
                <tbody>
                  {recentEvents.map(ev => (
                    <tr key={ev.event_id}>
                      <td>
                        <Link href={`/events/${ev.event_id}`} style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {ev.event_name}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ev.location}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{ev.disaster_type}</td>
                      <td><span className={getBadgeClass(ev.severity_level)}>{ev.severity_level}</span></td>
                      <td><span className={getBadgeClass(ev.status)}>{ev.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>
        </div>

        {/* Recent Reports */}
        <div className="table-container fade-in-up stagger-3">
          <div className="table-header">
            <h3>🚨 Recent Reports</h3>
            <Link href="/reports" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-wrapper">
            {recentReports.length === 0
              ? <div className="empty-state"><div className="icon">📭</div><p>No reports found</p></div>
              : <table>
                <thead><tr><th>Location</th><th>Severity</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>
                  {recentReports.map(rp => (
                    <tr key={rp.report_id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{rp.location}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rp.citizen_name}</div>
                      </td>
                      <td><span className={getBadgeClass(rp.severity_level)}>{rp.severity_level}</span></td>
                      <td><span className={getBadgeClass(rp.status)}>{rp.status}</span></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(rp.report_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>

      {/* Teams Status */}
      {canViewTeams && (
        <div className="table-container fade-in-up stagger-4" style={{ marginTop: 20 }}>
          <div className="table-header">
            <h3>🚁 Rescue Teams Overview</h3>
            <Link href="/teams" className="btn btn-secondary btn-sm">Manage Teams</Link>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Team</th><th>Type</th><th>Location</th><th>Status</th><th>Size</th></tr></thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.team_id}>
                    <td style={{ fontWeight: 500 }}>{t.team_name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t.team_type}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t.current_location}</td>
                    <td><span className={getBadgeClass(t.availability_status)}>{t.availability_status}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.team_size} members</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
