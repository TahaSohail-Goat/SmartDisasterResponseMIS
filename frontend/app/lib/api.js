const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new ApiError('Session expired', 401);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || data.message || `Request failed (${res.status})`, res.status);
  }

  return data;
}

export const api = {
  get:   (path)       => request(path),
  post:  (path, body) => request(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del:   (path)       => request(path, { method: 'DELETE' }),
};

export { ApiError };
