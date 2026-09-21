// SeatFlow — api.js
// Every server interaction in the app goes through apiRequest(). Right now
// DEMO_MODE is on, so requests are served from the local demo state instead
// of a real network call — this is the seam where a real backend plugs in.

import {
  AppState, persist, seedDemoDataIfEmpty,
  getEvents, getEvent, addEvent,
  getGuestsForEvent, addGuestToEvent, removeGuestFromEvent, updateGuestInEvent,
  getTablesForEvent, addTableToEvent, updateTableInEvent, removeTableFromEvent,
} from './state.js';
import { uid } from './utils.js';

// Flip to false once the backend is deployed and reachable at API_BASE_URL.
export const DEMO_MODE = true;

// Public config only — no secrets belong here (see section 61 of the spec).
// After deploying the backend (e.g. to Render), replace this with its URL,
// e.g. 'https://seatflow-backend.onrender.com/api/v1'.
export const API_BASE_URL = 'http://localhost:4000/api/v1';

seedDemoDataIfEmpty();

/**
 * Centralized request function. In production (DEMO_MODE = false) this
 * performs a real fetch against API_BASE_URL. In demo mode it resolves
 * against the local demo state so the whole frontend works standalone.
 */
export async function apiRequest(endpoint, options = {}) {
  if (!DEMO_MODE) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
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

/**
 * AI seating optimizer client stub. The frontend never talks to an AI
 * provider directly — this always goes through the backend endpoint below,
 * which is the only place a Claude API key would ever live.
 */
export async function optimizeSeating(eventId, rules) {
  return apiRequest(`/events/${eventId}/optimizer`, {
    method: 'POST',
    body: JSON.stringify({ rules }),
  });
}

export { AppState, persist };
