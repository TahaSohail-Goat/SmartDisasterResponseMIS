'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './lib/api';
import { useAuth } from './context/AuthContext';
import { getBadgeClass, fmt, fmtMoney } from './lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AnimatedCounter from './components/AnimatedCounter';

/* ── 3D Tilt Stat Card ─────────────────────────────────────── */
function StatCard({ icon, label, value, color, sub, index = 0, live = false }) {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    card.style.transform = `perspective(600px) rotateX(${y}deg) rotateY(${x}deg) scale(1.03)`;
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)';
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className="stat-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'default', transformStyle: 'preserve-3d', transition: 'transform 0.15s ease, box-shadow 0.3s ease', willChange: 'transform' }}
      whileHover={{ boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 30px ${color}30` }}
    >
      <div className="stat-icon" style={{ background: `${color}20`, fontSize: '1.5rem', boxShadow: `0 0 16px ${color}30` }}>
        {icon}
      </div>
      <div className="stat-info">
        <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {live && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
              display: 'inline-block', animation: 'liveBlink 1.2s ease infinite',
              boxShadow: '0 0 6px #ef4444'
            }} />
          )}
        </div>
        <div className="value">
          <AnimatedCounter target={value ?? 0} color={color} duration={1400} />
        </div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const [events, setEvents]   = useState([]);
  const [reports, setReports] = useState([]);
  const [teams, setTeams]     = useState([]);
  const [loading, setLoading] = useState(true);

  const canViewTeams = hasRole('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator');

  const load = useCallback(() => {
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

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return (
    <div className="loading-container">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
          LOADING MISSION DATA...
        </div>
      </div>
    </div>
  );

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
      {/* ── Critical Alert Banner ──────────────────────────── */}
      {criticalReports > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 20px', borderRadius: 12, marginBottom: 24,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.1)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Scan line effect */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)',
            animation: 'scanline 2s linear infinite',
          }} />
          <span style={{ fontSize: '1.2rem' }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.9rem' }}>
              CRITICAL ALERT — {criticalReports} Critical Report{criticalReports > 1 ? 's' : ''} Active
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(252, 165, 165, 0.7)', marginTop: 2 }}>
              Immediate attention required · Last updated just now
            </div>
          </div>
          <Link href="/reports" style={{
            padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5',
            fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            View Reports →
          </Link>
        </motion.div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>{greeting}, {user?.username} 👋</h1>
        <p>
          Role: <strong style={{ color: 'var(--accent-hover)' }}>{roleLabel}</strong>
          {' · '}
          {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </motion.div>

      {/* ── Stat Grid ──────────────────────────────────────── */}
      <div className="stat-grid">
        <StatCard icon="🌪️" label="Active Disasters" value={activeEvents}    color="#ef4444" sub={`of ${events.length} total`}   index={0} live />
        <StatCard icon="🚨" label="Critical Reports"  value={criticalReports} color="#f97316" sub={`of ${reports.length} total`}  index={1} />
        {canViewTeams && <StatCard icon="🚁" label="Teams Available" value={availableTeams}  color="#10b981" sub={`${busyTeams} busy`}          index={2} />}
        <StatCard icon="📋" label="Total Reports"     value={reports.length}  color="#0ea5e9" index={3} />
      </div>

      {/* ── Two-column tables ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <motion.div
          className="table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
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
        </motion.div>

        <motion.div
          className="table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
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
        </motion.div>
      </div>

      {/* ── Teams Status ────────────────────────────────────── */}
      {canViewTeams && (
        <motion.div
          className="table-container"
          style={{ marginTop: 20 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
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
        </motion.div>
      )}
    </div>
  );
}
