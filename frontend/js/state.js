// SeatFlow — state.js
// Lightweight client session cache for the authenticated organizer.
// Server data is fetched through api.js; this file does not store demo events,
// guests, tables, or other application data.

const USER_KEY = 'seatflow_user';

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function getCurrentUser() {
  return readUser();
}

export function setCurrentUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.warn('SeatFlow: could not persist session user.', error);
  }
}

export function logoutUser() {
  localStorage.removeItem(USER_KEY);
}
