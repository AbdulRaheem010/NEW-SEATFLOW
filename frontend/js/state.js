// SeatFlow — state.js
// Lightweight centralized state for DEMO_MODE. Backed by localStorage so an
// organizer's demo data survives across dashboard pages and reloads.
// This is a stand-in for real server state; every read/write here is what
// api.js will eventually replace with real REST calls (see api.js).

import { uid } from './utils.js';

const STORAGE_KEY = 'seatflow_demo_state_v1';

const defaultState = {
  currentUser: null,
  events: [],
  guests: {},      // eventId -> Guest[]
  tables: {},       // eventId -> Table[]
  settings: {},
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredCloneSafe(defaultState), ...parsed };
  } catch (e) {
    console.warn('SeatFlow: could not read demo state, resetting.', e);
    return structuredCloneSafe(defaultState);
  }
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const AppState = load();

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
  } catch (e) {
    console.warn('SeatFlow: could not persist demo state.', e);
  }
}

/* ------------------------------------------------------------------ */
/* Demo data seeding — only runs once, when no events exist yet        */
/* ------------------------------------------------------------------ */
export function seedDemoDataIfEmpty() {
  if (AppState.events.length > 0) return;

  const weddingId = uid('evt');
  const galaId = uid('evt');
  const confId = uid('evt');

  AppState.events = [
    {
      id: weddingId,
      slug: 'alex-maria-wedding',
      name: 'Alex & Maria\u2019s Wedding',
      type: 'Wedding',
      date: addDays(18),
      startTime: '17:00',
      endTime: '23:00',
      venue: 'The Grand Linden',
      description: 'An evening wedding reception for close friends and family.',
      status: 'live',
      guestCount: 100,
      assignedCount: 96,
      checkedInCount: 0,
      qrActive: true,
    },
    {
      id: galaId,
      slug: 'harrow-vine-gala',
      name: 'Harrow & Vine Annual Gala',
      type: 'Gala',
      date: addDays(34),
      startTime: '18:30',
      endTime: '22:30',
      venue: 'Foster Hall',
      description: 'Black-tie fundraising gala.',
      status: 'draft',
      guestCount: 240,
      assignedCount: 180,
      checkedInCount: 0,
      qrActive: false,
    },
    {
      id: confId,
      slug: 'milbrook-summit',
      name: 'Milbrook Product Summit',
      type: 'Conference',
      date: addDays(6),
      startTime: '09:00',
      endTime: '17:00',
      venue: 'Casa Delmar Conference Center',
      description: 'Annual product and partner summit.',
      status: 'live',
      guestCount: 486,
      assignedCount: 472,
      checkedInCount: 381,
      qrActive: true,
    },
  ];

  AppState.guests[weddingId] = sampleGuests(weddingId, 6);
  AppState.guests[galaId] = sampleGuests(galaId, 4);
  AppState.guests[confId] = sampleGuests(confId, 6);

  persist();
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function sampleGuests(eventId, count) {
  const names = ['Sarah Johnson', 'Ahmed Malik', 'Grace Lin', 'Michael Osei', 'David Chen', 'Priya Shah', 'Naomi Reyes', 'Daniel Kim'];
  return names.slice(0, count).map((name, i) => {
    const [firstName, lastName] = name.split(' ');
    return {
      id: uid('guest'),
      eventId,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: '',
      group: '',
      vip: i === 0,
      meal: 'Standard',
      tableId: null,
      seatNumber: null,
      checkedIn: false,
      notes: '',
    };
  });
}

/* ------------------------------------------------------------------ */
/* Accessors                                                           */
/* ------------------------------------------------------------------ */
export function getCurrentUser() {
  return AppState.currentUser;
}

export function setCurrentUser(user) {
  AppState.currentUser = user;
  persist();
}

export function logoutUser() {
  AppState.currentUser = null;
  persist();
}

export function getEvents() {
  return AppState.events;
}

export function getEvent(eventId) {
  return AppState.events.find((e) => e.id === eventId) || null;
}

export function addEvent(event) {
  AppState.events.unshift(event);
  AppState.guests[event.id] = AppState.guests[event.id] || [];
  persist();
  return event;
}

export function getGuestsForEvent(eventId) {
  return AppState.guests[eventId] || [];
}

export function addGuestToEvent(eventId, guest) {
  if (!AppState.guests[eventId]) AppState.guests[eventId] = [];
  AppState.guests[eventId].push(guest);
  persist();
  return guest;
}

export function removeGuestFromEvent(eventId, guestId) {
  if (!AppState.guests[eventId]) return;
  AppState.guests[eventId] = AppState.guests[eventId].filter((g) => g.id !== guestId);
  persist();
}

export function updateGuestInEvent(eventId, guestId, patch) {
  const list = AppState.guests[eventId] || [];
  const guest = list.find((g) => g.id === guestId);
  if (!guest) return null;
  Object.assign(guest, patch);
  persist();
  return guest;
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */
export function getTablesForEvent(eventId) {
  return AppState.tables[eventId] || [];
}

export function addTableToEvent(eventId, table) {
  if (!AppState.tables[eventId]) AppState.tables[eventId] = [];
  AppState.tables[eventId].push(table);
  persist();
  return table;
}

export function updateTableInEvent(eventId, tableId, patch) {
  const list = AppState.tables[eventId] || [];
  const table = list.find((t) => t.id === tableId);
  if (!table) return null;
  Object.assign(table, patch);
  persist();
  return table;
}

export function removeTableFromEvent(eventId, tableId) {
  if (!AppState.tables[eventId]) return;
  AppState.tables[eventId] = AppState.tables[eventId].filter((t) => t.id !== tableId);
  // Unseat any guest who was at this table.
  (AppState.guests[eventId] || []).forEach((g) => {
    if (g.tableId === tableId) { g.tableId = null; g.seatNumber = null; }
  });
  persist();
}
