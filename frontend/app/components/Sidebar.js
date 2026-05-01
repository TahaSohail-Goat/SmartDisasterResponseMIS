'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

// Strict role-based navigation:
// System_Admin        → Everything
// Disaster_Coordinator → Dashboard, Disasters, Reports, Teams, Inventory, Finance, Hospitals, Approvals, Analytics
// Rescue_Operator      → Dashboard, Reports, Teams, Inventory, Hospitals, Analytics
// Warehouse_Manager    → Dashboard, Inventory, Procurement, Approvals, Analytics
// Finance_Officer      → Dashboard, Finance, Procurement, Approvals, Analytics
// Citizen              → Dashboard, Reports, Hospitals
const ALL_STAFF = ['System_Admin', 'Disaster_Coordinator', 'Rescue_Operator', 'Warehouse_Manager', 'Finance_Officer'];
const NAV_ITEMS = [
  { href: '/',            label: 'Dashboard',    icon: '📊', roles: null }, // all authenticated
  { href: '/events',      label: 'Disasters',    icon: '🌪️', roles: ['System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'] },
  { href: '/reports',     label: 'Reports',      icon: '🚨', roles: ['System_Admin', 'Disaster_Coordinator', 'Rescue_Operator', 'Citizen'] },
  { href: '/teams',       label: 'Rescue Teams', icon: '🚁', roles: ['System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'] },
  { href: '/inventory',   label: 'Inventory',    icon: '📦', roles: ['System_Admin', 'Warehouse_Manager', 'Disaster_Coordinator', 'Rescue_Operator'] },
  { href: '/procurement', label: 'Procurement',  icon: '🛒', roles: ['System_Admin', 'Warehouse_Manager', 'Finance_Officer'] },
  { href: '/finance',     label: 'Finance',      icon: '💰', roles: ['System_Admin', 'Finance_Officer'] },
  { href: '/hospitals',   label: 'Hospitals',    icon: '🏥', roles: ['System_Admin', 'Disaster_Coordinator', 'Rescue_Operator', 'Citizen'] },
  { href: '/approvals',   label: 'Approvals',    icon: '✅', roles: ['System_Admin', 'Disaster_Coordinator', 'Finance_Officer', 'Warehouse_Manager'] },
  { href: '/analytics',   label: 'Analytics',    icon: '📈', roles: ALL_STAFF },
  { href: '/audit',       label: 'Audit Log',    icon: '🔍', roles: ['System_Admin'] },
  { href: '/admin',       label: 'Admin',        icon: '👥', roles: ['System_Admin'] },
];

const ROLE_COLORS = {
  System_Admin:        '#0ea5e9',
  Disaster_Coordinator:'#f97316',
  Rescue_Operator:     '#10b981',
  Warehouse_Manager:   '#3b82f6',
  Finance_Officer:     '#f59e0b',
  Citizen:             '#06b6d4',
};

// Human-readable descriptions shown below username
const ROLE_BADGES = {
  System_Admin:        '🔑 Administrator',
  Disaster_Coordinator:'🎯 Coordinator',
  Rescue_Operator:     '🚁 Field Operator',
  Warehouse_Manager:   '📦 Warehouse Mgr',
  Finance_Officer:     '💰 Finance Officer',
  Citizen:             '👤 Citizen',
};

export default function Sidebar() {
  const pathname  = usePathname();
  const { user, logout, hasRole } = useAuth();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.some(r => hasRole(r))
  );

  const roleColor = ROLE_COLORS[user.role] || '#0ea5e9';
  const roleBadge = ROLE_BADGES[user.role]  || user.role;

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🛡️</div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>SDRMIS</span>
          <span className={styles.logoSub}>Disaster Response</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.navLabel}>Navigation</span>
          {visibleItems.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navText}>{item.label}</span>
                {isActive && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className={styles.userSection}>
        <div className={styles.userInfo}>
          <div className={styles.avatar} style={{ background: roleColor }}>
            {(user.username || 'U')[0].toUpperCase()}
          </div>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{user.username}</span>
            <span className={styles.userRole} style={{ color: roleColor }}>{roleBadge}</span>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={logout} title="Logout">⏻</button>
      </div>
    </aside>
  );
}
