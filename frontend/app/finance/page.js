'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { getBadgeClass, fmt, fmtMoney } from '../lib/utils';
import Modal from '../components/Modal';

const DONOR_TYPES   = ['Individual', 'Organization', 'Government'];
const PAYMENT_TYPES = ['Bank Transfer', 'Cheque', 'EasyPaisa', 'JazzCash', 'RTGS', 'Debit Card', 'Cash'];
const CATEGORIES    = ['Rescue Operations', 'Medical Supplies', 'Food Distribution', 'Search & Rescue', 'Shelter', 'Medical Camp Setup', 'Fire Suppression', 'Other'];

export default function FinancePage() {
  const toast = useToast();

  const [summary, setSummary]         = useState([]);
  const [transactions, setTxns]       = useState([]);
  const [events, setEvents]           = useState([]);
  const [citizens, setCitizens]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setTab]           = useState('summary');
  const [txnFilter, setTxnFilter]     = useState('');
  const [showDonation, setShowDon]    = useState(false);
  const [showExpense, setShowExp]     = useState(false);
  const [submitting, setSub]          = useState(false);
  const [donForm, setDonForm]         = useState({
    citizen_id: '', disaster_event_id: '', donor_name: '',
    donor_type: 'Individual', amount: '', payment_method: 'Bank Transfer', transaction_reference: '',
  });
  const [expForm, setExpForm] = useState({
    disaster_event_id: '', category: '', amount: '', description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = txnFilter ? `?type=${txnFilter}` : '';
      const [sum, txns, ev] = await Promise.all([
        api.get('/api/finance/summary'),
        api.get(`/api/finance/transactions${params}`),
        api.get('/api/events'),
      ]);
      setSummary(sum);
      setTxns(txns);
      setEvents(ev);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [txnFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleDonation(e) {
    e.preventDefault();
    const { citizen_id, disaster_event_id, donor_name, donor_type, amount, payment_method, transaction_reference } = donForm;
    if (!citizen_id || !disaster_event_id || !donor_name || !amount || !transaction_reference) {
      toast.error('All fields are required'); return;
    }
    if (parseFloat(amount) <= 0) { toast.error('Amount must be positive'); return; }
    setSub(true);
    try {
      await api.post('/api/finance/donations', {
        ...donForm,
        citizen_id: parseInt(donForm.citizen_id),
        disaster_event_id: parseInt(donForm.disaster_event_id),
        amount: parseFloat(donForm.amount),
      });
      toast.success('Donation recorded successfully!');
      setShowDon(false);
      setDonForm({ citizen_id: '', disaster_event_id: '', donor_name: '', donor_type: 'Individual', amount: '', payment_method: 'Bank Transfer', transaction_reference: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  async function handleExpense(e) {
    e.preventDefault();
    const { disaster_event_id, category, amount, description } = expForm;
    if (!disaster_event_id || !category || !amount || !description) {
      toast.error('All fields are required'); return;
    }
    if (parseFloat(amount) <= 0) { toast.error('Amount must be positive'); return; }
    setSub(true);
    try {
      await api.post('/api/finance/expenses', {
        ...expForm,
        disaster_event_id: parseInt(expForm.disaster_event_id),
        amount: parseFloat(expForm.amount),
      });
      toast.success('Expense submitted for approval!');
      setShowExp(false);
      setExpForm({ disaster_event_id: '', category: '', amount: '', description: '' });
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSub(false); }
  }

  const totalDonations = transactions.filter(t => t.transaction_type === 'Donation').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses  = transactions.filter(t => t.transaction_type === 'Expense').reduce((s, t) => s + Number(t.amount), 0);
  const netBalance     = totalDonations - totalExpenses;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>💰 Financial Management</h1>
          <p>Track donations, expenses, and financial transactions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowDon(true)}>+ Record Donation</button>
          <button className="btn btn-secondary" onClick={() => setShowExp(true)}>+ Log Expense</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#10b98120' }}>💚</div>
          <div className="stat-info">
            <div className="label">Total Donations</div>
            <div className="value" style={{ color: '#10b981', fontSize: '1.2rem' }}>{fmtMoney(totalDonations)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ef444420' }}>💸</div>
          <div className="stat-info">
            <div className="label">Total Expenses</div>
            <div className="value" style={{ color: '#ef4444', fontSize: '1.2rem' }}>{fmtMoney(totalExpenses)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: (netBalance >= 0 ? '#6366f1' : '#ef4444') + '20' }}>⚖️</div>
          <div className="stat-info">
            <div className="label">Net Balance</div>
            <div className="value" style={{ color: netBalance >= 0 ? '#6366f1' : '#ef4444', fontSize: '1.2rem' }}>
              {fmtMoney(Math.abs(netBalance))}
            </div>
            <div style={{ fontSize: '0.72rem', color: netBalance >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
              {netBalance >= 0 ? '▲ Surplus' : '▼ Deficit'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-card)',
        padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', width: 'fit-content' }}>
        {[['summary','📊 By Event'], ['transactions','🔄 All Transactions']].map(([id, label]) => (
          <button key={id} className={activeTab === id ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="table-container">
          <div className="table-header"><h3>Financial Summary by Event</h3></div>
          {loading ? <div className="loading-container"><div className="spinner" /></div>
            : summary.length === 0
              ? <div className="empty-state"><div className="icon">💰</div><p>No financial data found</p></div>
              : <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Event</th><th>Donations</th><th>Expenses</th><th>Net Balance</th></tr>
                  </thead>
                  <tbody>
                    {summary.map((s, i) => {
                      const net = Number(s.total_donations || 0) - Number(s.total_expenses || 0);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{s.event_name || s.disaster_event_id}</td>
                          <td style={{ color: '#10b981', fontWeight: 600 }}>{fmtMoney(s.total_donations)}</td>
                          <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmtMoney(s.total_expenses)}</td>
                          <td style={{ fontWeight: 700, color: net >= 0 ? '#6366f1' : '#ef4444' }}>
                            {net >= 0 ? '+' : '-'}{fmtMoney(Math.abs(net))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="table-container">
          <div className="table-header">
            <h3>Transactions ({transactions.length})</h3>
            <select className="form-control" value={txnFilter} onChange={e => setTxnFilter(e.target.value)} style={{ width: 160 }}>
              <option value="">All Types</option>
              {['Donation', 'Expense', 'Procurement'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {loading ? <div className="loading-container"><div className="spinner" /></div>
            : transactions.length === 0
              ? <div className="empty-state"><div className="icon">🔄</div><p>No transactions found</p></div>
              : <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Type</th><th>Event</th><th>Amount</th><th>Recorded By</th><th>Notes</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.transaction_id}>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.73rem', fontWeight: 600,
                            background: t.transaction_type === 'Donation' ? '#10b98120' : t.transaction_type === 'Expense' ? '#ef444420' : '#6366f120',
                            color: t.transaction_type === 'Donation' ? '#10b981' : t.transaction_type === 'Expense' ? '#ef4444' : '#6366f1',
                          }}>{t.transaction_type}</span>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{t.event_name}</td>
                        <td style={{ fontWeight: 700,
                          color: t.transaction_type === 'Donation' ? '#10b981' : '#ef4444' }}>
                          {fmtMoney(t.amount)}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.recorded_by_name}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 200 }}>
                          {t.notes?.slice(0, 60)}{t.notes?.length > 60 ? '…' : ''}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(t.transaction_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Donation Modal */}
      <Modal isOpen={showDonation} onClose={() => setShowDon(false)} title="Record Donation"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowDon(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleDonation} disabled={submitting}>
              {submitting ? 'Recording…' : 'Record Donation'}
            </button>
          </>
        }>
        <div className="form-row">
          <div className="form-group">
            <label>Donor Name *</label>
            <input className="form-control" placeholder="Full name or org"
              value={donForm.donor_name} onChange={e => setDonForm({ ...donForm, donor_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Donor Type *</label>
            <select className="form-control" value={donForm.donor_type}
              onChange={e => setDonForm({ ...donForm, donor_type: e.target.value })}>
              {DONOR_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Citizen ID *</label>
          <input className="form-control" type="number" placeholder="e.g. 1 (Registered Citizen ID)"
            value={donForm.citizen_id} onChange={e => setDonForm({ ...donForm, citizen_id: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Disaster Event *</label>
          <select className="form-control" value={donForm.disaster_event_id}
            onChange={e => setDonForm({ ...donForm, disaster_event_id: e.target.value })}>
            <option value="">Select event…</option>
            {events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Amount (₨) *</label>
            <input className="form-control" type="number" min="1" step="any" placeholder="50000"
              value={donForm.amount} onChange={e => setDonForm({ ...donForm, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Payment Method *</label>
            <select className="form-control" value={donForm.payment_method}
              onChange={e => setDonForm({ ...donForm, payment_method: e.target.value })}>
              {PAYMENT_TYPES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Transaction Reference *</label>
          <input className="form-control" placeholder="e.g. TRF-2025-0099"
            value={donForm.transaction_reference} onChange={e => setDonForm({ ...donForm, transaction_reference: e.target.value })} />
        </div>
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={showExpense} onClose={() => setShowExp(false)} title="Log Expense"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowExp(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleExpense} disabled={submitting}>
              {submitting ? 'Saving…' : 'Submit Expense'}
            </button>
          </>
        }>
        <div className="form-group">
          <label>Disaster Event *</label>
          <select className="form-control" value={expForm.disaster_event_id}
            onChange={e => setExpForm({ ...expForm, disaster_event_id: e.target.value })}>
            <option value="">Select event…</option>
            {events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Category *</label>
            <select className="form-control" value={expForm.category}
              onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
              <option value="">Select category…</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₨) *</label>
            <input className="form-control" type="number" min="1" step="any" placeholder="150000"
              value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea className="form-control" rows={3} placeholder="Describe what the expense covers…"
            value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
