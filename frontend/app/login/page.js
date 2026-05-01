'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { motion } from 'framer-motion';
import styles from './login.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const toast  = useToast();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      toast.success(`Welcome back, ${user.username}!`);
      router.replace('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const DEMO_USERS = [
    { label: 'Admin', u: 'admin_ali',     p: 'Pass@1234', color: '#0ea5e9' },
    { label: 'Coordinator', u: 'coord_sara',    p: 'Pass@1234', color: '#f97316' },
    { label: 'Rescue Op', u: 'rescue_omar',  p: 'Pass@1234', color: '#10b981' },
    { label: 'Warehouse', u: 'wh_fatima',    p: 'Pass@1234', color: '#3b82f6' },
    { label: 'Finance', u: 'fin_ahmed',    p: 'Pass@1234', color: '#f59e0b' },
    { label: 'Citizen', u: 'citizen_hamza',p: 'Pass@1234', color: '#06b6d4' },
  ];

  return (
    <div className={styles.page}>
      {/* Animated background handled globally, or use localized blobs */}
      <div className={styles.bg}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      <div className={styles.container}>
        {/* Branding */}
        <motion.div 
          className={styles.brand}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className={styles.brandIcon}>🛡️</div>
          <h1 className={styles.brandTitle}>SDRMIS</h1>
          <p className={styles.brandSub}>Smart Disaster Response Management Information System</p>
        </motion.div>

        {/* Card */}
        <motion.div 
          className={styles.card}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.cardHeader}>
            <h2>Sign In</h2>
            <p>Access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="form-control"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className={styles.passWrap}>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? <><span className={styles.btnSpinner} /> Signing in…</> : 'Sign In →'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className={styles.demoSection}>
            <p className={styles.demoLabel}>Quick login (demo accounts)</p>
            <div className={styles.demoGrid}>
              {DEMO_USERS.map(du => (
                <button
                  key={du.u}
                  className={styles.demoBtn}
                  style={{ '--role-color': du.color }}
                  onClick={() => { setUsername(du.u); setPassword(du.p); }}
                  type="button"
                >
                  <span className={styles.demoDot} />
                  {du.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
            <a href="/signup" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign up as Citizen</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
