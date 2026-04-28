'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children, roles }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (roles && !roles.includes(user.role)) {
        router.replace('/');
      }
    }
  }, [user, loading, roles, router]);

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;

  return children;
}
