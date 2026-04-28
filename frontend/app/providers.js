'use client';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Sidebar';
import AuthGuard from './components/AuthGuard';
import { usePathname } from 'next/navigation';

function AppShell({ children }) {
  const pathname = usePathname();
  const isPublic = pathname === '/login' || pathname === '/signup';
  if (isPublic) return children;
  return (
    <AuthGuard>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </AuthGuard>
  );
}

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </AuthProvider>
  );
}
