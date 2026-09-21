// SeatFlow — api.js
// Centralized client for the live SeatFlow REST API.

export const API_BASE_URL = (
  window.SEATFLOW_API_BASE_URL ||
  'https://seatflow-backend-1q25.onrender.com/api/v1'
).replace(/\/$/, '');

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('seatflow_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message = data && typeof data === 'object' && data.error
      ? data.error
      : `Request failed: ${res.status}`;

    if (res.status === 401) {
      localStorage.removeItem('seatflow_token');
      localStorage.removeItem('seatflow_user');
    }

    throw new Error(message);
  }

  return data;
}
