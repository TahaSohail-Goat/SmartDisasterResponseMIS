export function getBadgeClass(value) {
  if (!value) return 'badge badge-inactive';
  const v = value.toLowerCase();
  if (v === 'critical') return 'badge badge-critical';
  if (v === 'high') return 'badge badge-high';
  if (v === 'medium') return 'badge badge-medium';
  if (v === 'low') return 'badge badge-low';
  if (v === 'active') return 'badge badge-active';
  if (v === 'completed') return 'badge badge-completed';
  if (v === 'pending') return 'badge badge-pending';
  if (v === 'inactive') return 'badge badge-inactive';
  if (v === 'available') return 'badge badge-available';
  if (v === 'busy') return 'badge badge-busy';
  if (v === 'assigned') return 'badge badge-assigned';
  if (v === 'approved') return 'badge badge-approved';
  if (v === 'rejected') return 'badge badge-rejected';
  if (v === 'admitted') return 'badge badge-admitted';
  if (v === 'discharged') return 'badge badge-discharged';
  if (v === 'deceased') return 'badge badge-deceased';
  return 'badge badge-inactive';
}

export function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function fmtMoney(amount) {
  if (amount == null) return '—';
  return '₨ ' + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function severityDot(level) {
  const colors = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#10b981' };
  return colors[level] || '#8b95a8';
}
