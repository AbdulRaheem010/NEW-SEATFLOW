// SeatFlow — api.js
// Every server interaction in the app goes through apiRequest(). Production
// requests use the live SeatFlow backend; the demo router remains as a fallback seam.

import {
  AppState, persist, seedDemoDataIfEmpty,
  getEvents, getEvent, addEvent,
  getGuestsForEvent, addGuestToEvent, removeGuestFromEvent, updateGuestInEvent,
  getTablesForEvent, addTableToEvent, updateTableInEvent, removeTableFromEvent,
} from './state.js';
import { uid } from './utils.js';

// Production mode: requests use the deployed backend.
export const DEMO_MODE = false;

// Public config only — no secrets belong here.
// The live Render backend is the default; window.SEATFLOW_API_BASE_URL can
// still override it if a different backend URL is needed later.
export const API_BASE_URL = (
  window.SEATFLOW_API_BASE_URL ||
  'https://seatflow-backend-1q25.onrender.com/api/v1'
).replace(/\/$/, '');

seedDemoDataIfEmpty();

/** Centralized request function for live API and optional demo fallback. */
export async function apiRequest(endpoint, options = {}) {
  if (!DEMO_MODE) {
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
    const data = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const message = data && typeof data === 'object' && data.error
        ? data.error
        : `Request failed: ${res.status}`;
      if (res.status === 401) {
        localStorage.removeItem('seatflow_token');
      }
      throw new Error(message);
    }
    return data;
  }
  return demoRouter(endpoint, options);
}

/* ------------------------------------------------------------------ */
/* Demo router — maps REST-style endpoints to local demo state          */
/* ------------------------------------------------------------------ */
async function demoRouter(endpoint, options) {
  await simulateLatency();
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : null;

  if (endpoint === '/events' && method === 'GET') {
    return { events: getEvents() };
  }

  if (endpoint === '/events' && method === 'POST') {
    const event = {
      id: uid('evt'),
      status: 'draft',
      guestCount: 0,
      assignedCount: 0,
      checkedInCount: 0,
      qrActive: false,
      ...body,
    };
    addEvent(event);
    return { event };
  }

  const eventMatch = endpoint.match(/^\/events\/([^/]+)$/);
  if (eventMatch && method === 'GET') {
    const event = getEvent(eventMatch[1]);
    if (!event) throw new Error('Event not found');
    return { event };
  }

  const guestsMatch = endpoint.match(/^\/events\/([^/]+)\/guests$/);
  if (guestsMatch && method === 'GET') {
    return { guests: getGuestsForEvent(guestsMatch[1]) };
  }
  if (guestsMatch && method === 'POST') {
    const guest = { id: uid('guest'), eventId: guestsMatch[1], checkedIn: false, tableId: null, seatNumber: null, ...body };
    addGuestToEvent(guestsMatch[1], guest);
    return { guest };
  }

  const guestItemMatch = endpoint.match(/^\/events\/([^/]+)\/guests\/([^/]+)$/);
  if (guestItemMatch && method === 'DELETE') {
    removeGuestFromEvent(guestItemMatch[1], guestItemMatch[2]);
    return { ok: true };
  }
  if (guestItemMatch && method === 'PATCH') {
    const guest = updateGuestInEvent(guestItemMatch[1], guestItemMatch[2], body || {});
    if (!guest) throw new Error('Guest not found');
    return { guest };
  }

  const checkInMatch = endpoint.match(/^\/events\/([^/]+)\/guests\/([^/]+)\/check-in$/);
  if (checkInMatch && method === 'POST') {
    const guest = updateGuestInEvent(checkInMatch[1], checkInMatch[2], { checkedIn: true, checkedInAt: new Date().toISOString() });
    if (!guest) throw new Error('Guest not found');
    return { guest };
  }

  const importMatch = endpoint.match(/^\/events\/([^/]+)\/guests\/import$/);
  if (importMatch && method === 'POST') {
    const guests = (body?.guests || []).filter((g) => g.firstName && g.lastName);
    const imported = guests.map((g) => addGuestToEvent(importMatch[1], {
      id: uid('guest'), eventId: importMatch[1], tableId: null, seatNumber: null, checkedIn: false, ...g,
    }));
    return { imported: imported.length, skipped: (body?.guests || []).length - imported.length, guests: imported };
  }

  const tablesMatch = endpoint.match(/^\/events\/([^/]+)\/tables$/);
  if (tablesMatch && method === 'GET') {
    return { tables: getTablesForEvent(tablesMatch[1]) };
  }
  if (tablesMatch && method === 'POST') {
    const table = { id: uid('table'), eventId: tablesMatch[1], name: 'New Table', capacity: 8, shape: 'round', x: 40, y: 40, width: 120, height: 120, rotation: 0, locked: false, color: null, ...body };
    addTableToEvent(tablesMatch[1], table);
    return { table };
  }

  const tableItemMatch = endpoint.match(/^\/events\/([^/]+)\/tables\/([^/]+)$/);
  if (tableItemMatch && method === 'PATCH') {
    const table = updateTableInEvent(tableItemMatch[1], tableItemMatch[2], body || {});
    if (!table) throw new Error('Table not found');
    return { table };
  }
  if (tableItemMatch && method === 'DELETE') {
    removeTableFromEvent(tableItemMatch[1], tableItemMatch[2]);
    return { ok: true };
  }

  throw new Error(`No demo handler for ${method} ${endpoint}`);
}

function simulateLatency() {
  return new Promise((resolve) => setTimeout(resolve, 260));
}

export { AppState, persist };
