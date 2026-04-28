'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../context/ToastContext';
import styles from '../login/login.module.css';
import Link from 'next/link';

export default function SignupPage() {
  const [form, setForm] = useState({
    username: '', password: '', email: '', phone: '', full_name: '', cnic: '', address: '', date_of_birth: '', gender: 'Male'
  });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username || !form.password || !form.email || !form.phone || !form.full_name || !form.cnic || !form.address || !form.date_of_birth) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      toast.success('Account created! You can now log in.');
      router.push('/login');
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      <div className={styles.container} style={{ maxWidth: 600 }}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🛡️</div>
          <h1 className={styles.brandTitle}>SDRMIS</h1>
          <p className={styles.brandSub}>Register as a Citizen</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Create Account</h2>
            <p>Join the disaster response network</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} style={{ display: 'grid', gap: '16px', gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="full_name">Full Name *</label>
              <input id="full_name" type="text" className="form-control" placeholder="John Doe"
                value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="username">Username *</label>
              <input id="username" type="text" className="form-control" placeholder="johndoe123"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email *</label>
              <input id="email" type="email" className="form-control" placeholder="john@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="password">Password *</label>
              <div className={styles.passWrap}>
                <input id="password" type={showPass ? 'text' : 'password'} className="form-control" placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="cnic">CNIC *</label>
              <input id="cnic" type="text" className="form-control" placeholder="12345-1234567-1"
                value={form.cnic} onChange={e => setForm({ ...form, cnic: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="phone">Phone *</label>
              <input id="phone" type="text" className="form-control" placeholder="0300-1234567"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="date_of_birth">Date of Birth *</label>
              <input id="date_of_birth" type="date" className="form-control"
                value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="gender">Gender</label>
              <select id="gender" className="form-control" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
              <label htmlFor="address">Address *</label>
              <input id="address" type="text" className="form-control" placeholder="123 Street Name, City"
                value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                {loading ? <><span className={styles.btnSpinner} /> Signing up…</> : 'Sign Up →'}
              </button>
            </div>
            
            <div style={{ gridColumn: 'span 2', textAlign: 'center', marginTop: 12, fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
              <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign In</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
