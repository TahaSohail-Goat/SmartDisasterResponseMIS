'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getBadgeClass, fmt, fmtDate, fmtMoney } from '../../lib/utils';
import Link from 'next/link';

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { hasRole } = useAuth();
  const toast = useToast();
  const canClose = hasRole('System_Admin');

  const [event, setEvent]         = useState(null);
  const [reports, setReports]     = useState([]);
  const [teams, setTeams]         = useState([]);
  const [finance, setFinance]     = useState(null);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      // 1. Get base event
      const events = await api.get('/api/events');
      const ev = events.find(e => e.event_id === parseInt(id));
      if (!ev) { toast.error('Event not found'); router.push('/events'); return; }
      setEvent(ev);

      // 2. Get related reports
      const reps = await api.get('/api/reports');
      setReports(reps.filter(r => r.disaster_event_id === parseInt(id)));

      // 3. Get related team assignments (this requires a special call or filtering)
      const tms = await api.get('/api/teams');
      // teams API currently returns team availability, not assignments per event.
      // But we can show available teams nearby, or just skip assignments if the endpoint isn't exposed.
      setTeams(tms);

      // 4. Get finance summary for this event
      const fin = await api.get('/api/finance/summary');
      setFinance(fin.find(f => f.disaster_event_id === parseInt(id)) || { total_donations: 0, total_expenses: 0 });

    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [id, router, toast]);

  useEffect(() => { load(); }, [load]);

  async function handleClose() {
    if (!confirm('Close this disaster event? This will mark it as Completed and trigger cascading closure of reports and assignments.')) return;
    try {
      await api.patch(`/api/events/${id}/close`, {});
      toast.success('Event closed successfully');
      load();
    } catch (err) { toast.error(err.message); }
  }

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!event) return null;

  const criticalReps = reports.filter(r => r.severity_level === 'Critical').length;
  const netFin = (finance?.total_donations || 0) - (finance?.total_expenses || 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Link href="/events" className="btn btn-ghost btn-sm" style={{ padding: 0 }}>← Back</Link>
          <span className={getBadgeClass(event.status)}>{event.status}</span>
          <span className={getBadgeClass(event.severity_level)}>{event.severity_level}</span>
        </div>
        <h1>{event.event_name}</h1>
        <p>{event.location} • {event.disaster_type}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* ── Left Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div className="card fade-in-up">
            <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Description</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {event.description || 'No description provided.'}
            </p>
          </div>

          <div className="table-container fade-in-up stagger-1">
            <div className="table-header">
              <h3>Linked Emergency Reports ({reports.length})</h3>
              <Link href="/reports" className="btn btn-secondary btn-sm">View All</Link>
            </div>
            <div className="table-wrapper">
              {reports.length === 0
                ? <div className="empty-state" style={{ padding: '40px 20px' }}><p>No reports linked to this event</p></div>
                : <table>
                    <thead><tr><th>Location</th><th>Severity</th><th>Status</th><th>Reported</th></tr></thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={r.report_id}>
                          <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{r.location}</td>
                          <td><span className={getBadgeClass(r.severity_level)}>{r.severity_level}</span></td>
                          <td><span className={getBadgeClass(r.status)}>{r.status}</span></td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmt(r.report_time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>

        </div>

        {/* ── Right Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="card fade-in-up stagger-2" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.02)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                Event Details
              </h3>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Start Date</span>
                <span style={{ fontWeight: 500 }}>{fmtDate(event.start_date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>End Date</span>
                <span style={{ fontWeight: 500, color: event.end_date ? 'inherit' : 'var(--info)' }}>
                  {event.end_date ? fmtDate(event.end_date) : 'Ongoing'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Critical Reports</span>
                <span style={{ fontWeight: 600, color: criticalReps > 0 ? 'var(--danger)' : 'inherit' }}>{criticalReps}</span>
              </div>
              
              {event.status === 'Active' && canClose && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-primary)' }}>
                  <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleClose}>
                    Close Disaster Event
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card fade-in-up stagger-3" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', background: 'rgba(255,255,255,0.02)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                Financial Overview
              </h3>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Donations</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmtMoney(finance?.total_donations || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Expenses</span>
                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmtMoney(finance?.total_expenses || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border-primary)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Net Balance</span>
                <span style={{ fontWeight: 700, color: netFin >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                  {netFin >= 0 ? '+' : '-'}{fmtMoney(Math.abs(netFin))}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
