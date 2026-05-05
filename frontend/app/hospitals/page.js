'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

export default function HospitalsPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const canAdmit = hasRole('System_Admin', 'Disaster_Coordinator');

  const [hospitals, setHospitals] = useState([]);
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showAdmit, setShowAdmit] = useState(false);
  const [selHospital, setSelHosp] = useState(null);
  const [submitting, setSub]      = useState(false);
  const [showAutoAdmit, setShowAutoAdmit] = useState(false);
  const [form, setForm]           = useState({
    report_id: '', full_name: '', age: '', gender: 'Male', medical_notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, r] = await Promise.all([
        api.get('/api/hospitals'),
        api.get('/api/reports?status=Active'),
      ]);
      setHospitals(h);
      setReports(r);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = hospitals.filter(h =>
    !search ||
    h.hospital_name?.toLowerCase().includes(search.toLowerCase()) ||
    h.location?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdmit(e) {
    e.preventDefault();
    const { report_id, full_name, age, gender } = form;
    if (!report_id || !full_name || !age || !gender) {
      toast.error('All required fields must be filled'); return;
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 150) { toast.error('Enter a valid age'); return; }
    setSub(true);
    try {
      await api.post(`/api/hospitals/${selHospital.hospital_id}/admit`, {
        report_id: parseInt(form.report_id),
        full_name: form.full_name,
        age: ageNum,
        gender: form.gender,
        medical_notes: form.medical_notes || null,
      });
      toast.success(`Patient admitted to ${selHospital.hospital_name}`);
      setShowAdmit(false);
      setForm({ report_id: '', full_name: '', age: '', gender: 'Male', medical_notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  async function handleAutoAdmit(e) {
    e.preventDefault();
    const { report_id, full_name, age, gender } = form;
    if (!report_id || !full_name || !age || !gender) {
      toast.error('All required fields must be filled'); return;
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 150) { toast.error('Enter a valid age'); return; }
    setSub(true);
    try {
      const res = await api.post('/api/hospitals/auto-admit', {
        report_id: parseInt(form.report_id),
        full_name: form.full_name,
        age: ageNum,
        gender: form.gender,
        medical_notes: form.medical_notes || null,
      });
      toast.success(res.message);
      setShowAutoAdmit(false);
      setForm({ report_id: '', full_name: '', age: '', gender: 'Male', medical_notes: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>🏥 Hospitals & Medical Capacity</h1>
        <p>Monitor hospital occupancy and admit disaster patients</p>
      </div>

      {/* Capacity overview */}
      <div className="stat-grid">
        {[
          {
            label: 'Total Beds', icon: '🛏️',
            val: hospitals.reduce((s, h) => s + (h.total_beds || 0), 0),
            color: '#0ea5e9',
          },
          {
            label: 'Available Beds', icon: '✅',
            val: hospitals.reduce((s, h) => s + (h.available_beds || 0), 0),
            color: '#10b981',
          },
          {
            label: 'Occupied Beds', icon: '🔴',
            val: hospitals.reduce((s, h) => s + ((h.total_beds || 0) - (h.available_beds || 0)), 0),
            color: '#ef4444',
          },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '20', fontSize: '1.4rem' }}>{s.icon}</div>
            <div className="stat-info">
              <div className="label">{s.label}</div>
              <div className="value" style={{ color: s.color }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="filters-bar">
        <input className="form-control" placeholder="🔍 Search hospital or location…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        {canAdmit && (
          <button className="btn btn-primary" onClick={() => setShowAutoAdmit(true)}>
            🤖 Auto-Assign Best Hospital
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={load}>↺ Refresh</button>
      </div>

      {loading
        ? <div className="loading-container"><div className="spinner" /></div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {filtered.map(h => {
              const occupied = (h.total_beds || 0) - (h.available_beds || 0);
              const pct = h.total_beds > 0 ? Math.round((occupied / h.total_beds) * 100) : 0;
              const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';
              const isFull = h.available_beds === 0;

              return (
                <div key={h.hospital_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>{h.hospital_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>📍 {h.location}</div>
                    </div>
                    {isFull && (
                      <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'var(--danger-subtle)',
                        color: 'var(--danger)', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        FULL
                      </span>
                    )}
                  </div>

                  {/* Occupancy bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Occupancy</span>
                      <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <div className="progress-fill" style={{ width: pct + '%', background: barColor }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>{occupied} occupied</span>
                      <span>{h.available_beds} available / {h.total_beds} total</span>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Specialization</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(h.specialization || '').split(',').map((sp, i) => (
                        <span key={`${h.hospital_id}-spec-${i}`} style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)',
                          background: 'var(--accent-subtle)', color: 'var(--accent-hover)', fontSize: '0.72rem', fontWeight: 500 }}>
                          {sp.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>📞 {h.contact_number}</span>
                    {canAdmit && (
                      <button
                        className={`btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                        disabled={isFull}
                        onClick={() => { setSelHosp(h); setShowAdmit(true); }}
                      >
                        {isFull ? 'Full' : 'Admit Patient'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {/* Admit Modal */}
      <Modal isOpen={showAdmit} onClose={() => setShowAdmit(false)}
        title={`Admit Patient — ${selHospital?.hospital_name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAdmit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdmit} disabled={submitting}>
              {submitting ? 'Admitting…' : 'Admit Patient'}
            </button>
          </>
        }>
        {selHospital && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-subtle)',
            color: 'var(--info)', fontSize: '0.82rem', marginBottom: 16 }}>
            🛏️ {selHospital.available_beds} beds available at {selHospital.hospital_name}
          </div>
        )}
        <div className="form-group">
          <label>Linked Emergency Report *</label>
          <select className="form-control" value={form.report_id}
            onChange={e => setForm({ ...form, report_id: e.target.value })}>
            <option value="">Select active report…</option>
            {reports.map(r => (
              <option key={`admit-report-${r.report_id}`} value={r.report_id}>
                [{r.severity_level}] {r.location} — {r.citizen_name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Patient Full Name *</label>
          <input className="form-control" placeholder="e.g. Noor Fatima"
            value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Age *</label>
            <input className="form-control" type="number" min="1" max="150" placeholder="35"
              value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Gender *</label>
            <select className="form-control" value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value })}>
              {['Male', 'Female', 'Other'].map(g => <option key={`admit-gender-${g}`}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Medical Notes (optional)</label>
          <textarea className="form-control" rows={2} placeholder="Initial assessment notes…"
            value={form.medical_notes} onChange={e => setForm({ ...form, medical_notes: e.target.value })} />
        </div>
      </Modal>

      {/* Auto-Admit Modal */}
      <Modal isOpen={showAutoAdmit} onClose={() => setShowAutoAdmit(false)}
        title={`Auto-Assign Patient`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAutoAdmit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAutoAdmit} disabled={submitting}>
              {submitting ? 'Assigning…' : '🤖 Find Hospital & Admit'}
            </button>
          </>
        }>
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--info-subtle)',
          color: 'var(--info)', fontSize: '0.82rem', marginBottom: 16 }}>
          🤖 The system will automatically locate the hospital with the highest capacity and route the patient there to ensure load balancing.
        </div>
        <div className="form-group">
          <label>Linked Emergency Report *</label>
          <select className="form-control" value={form.report_id}
            onChange={e => setForm({ ...form, report_id: e.target.value })}>
            <option value="">Select active report…</option>
            {reports.map(r => (
              <option key={`auto-report-${r.report_id}`} value={r.report_id}>
                [{r.severity_level}] {r.location} — {r.citizen_name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Patient Full Name *</label>
          <input className="form-control" placeholder="e.g. Noor Fatima"
            value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Age *</label>
            <input className="form-control" type="number" min="1" max="150" placeholder="35"
              value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Gender *</label>
            <select className="form-control" value={form.gender}
              onChange={e => setForm({ ...form, gender: e.target.value })}>
              {['Male', 'Female', 'Other'].map(g => <option key={`auto-gender-${g}`}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Medical Notes (optional)</label>
          <textarea className="form-control" rows={2} placeholder="Initial assessment notes…"
            value={form.medical_notes} onChange={e => setForm({ ...form, medical_notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
