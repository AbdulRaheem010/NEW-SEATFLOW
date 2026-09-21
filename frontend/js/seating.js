// SeatFlow — seating.js
// Powers dashboard/seating.html: the visual drag-and-drop seating canvas.

import { requireAuth } from './auth.js';
import { apiRequest } from './api.js';
import { toast } from './utils.js';

async function currentEvent() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('event');
  const { events = [] } = await apiRequest('/events');

  if (requested) {
    const match = events.find((e) => e.id === requested || e.slug === requested);
    if (match) return match;
  }

  return events[0] || null;
}

const SHAPE_SIZE = { round: { w: 120, h: 120 }, square: { w: 110, h: 110 }, rectangle: { w: 170, h: 90 } };

async function initSeatingPage() {
  const canvas = document.querySelector('[data-seating-canvas]');
  if (!canvas) return;

  const event = await currentEvent();
  const eventId = event?.id || null;
  if (!eventId) {
    document.querySelector('[data-detail-body]').innerHTML = '<div class="detail-empty">No event is available. Create an event first.</div>';
    return;
  }

  let tables = [];
  let guests = [];
  let selectedTableId = null;
  let zoom = 1;
  const undoStack = [];
  const redoStack = [];

  function snapshot() {
    return JSON.stringify({
      tables: tables.map((t) => ({ ...t })),
      guests: guests.map((g) => ({ id: g.id, tableId: g.tableId ?? null, seatNumber: g.seatNumber ?? null })),
    });
  }

  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 30) undoStack.shift();
    redoStack.length = 0;
  }

  async function persistSnapshot(snap) {
    const target = JSON.parse(snap);
    const targetTables = target.tables || [];
    const targetGuests = target.guests || [];

    // Reconcile tables first. IDs from the snapshot may no longer exist, so
    // keep a map from snapshot IDs to the live/recreated table IDs.
    const currentById = new Map(tables.map((t) => [t.id, t]));
    const targetIds = new Set(targetTables.map((t) => t.id));
    const tableIdMap = new Map();

    for (const current of tables) {
      if (!targetIds.has(current.id)) {
        await apiRequest(`/events/${eventId}/tables/${current.id}`, { method: 'DELETE' });
      }
    }

    for (const targetTable of targetTables) {
      const current = currentById.get(targetTable.id);
      if (current) {
        tableIdMap.set(targetTable.id, current.id);
        const patch = {};
        for (const key of ['name', 'capacity', 'shape', 'x', 'y', 'locked']) {
          if (current[key] !== targetTable[key]) patch[key] = targetTable[key];
        }
        if (Object.keys(patch).length) {
          await apiRequest(`/events/${eventId}/tables/${current.id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          });
        }
      } else {
        const created = await apiRequest(`/events/${eventId}/tables`, {
          method: 'POST',
          body: JSON.stringify({
            name: targetTable.name,
            capacity: targetTable.capacity,
            shape: targetTable.shape,
            x: targetTable.x,
            y: targetTable.y,
          }),
        });
        const createdTable = created.table || created;
        if (!createdTable?.id) throw new Error('Could not recreate a table while restoring seating.');
        tableIdMap.set(targetTable.id, createdTable.id);
        if (targetTable.locked && !createdTable.locked) {
          await apiRequest(`/events/${eventId}/tables/${createdTable.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ locked: true }),
          });
        }
      }
    }

    const liveGuests = new Map(guests.map((g) => [g.id, g]));
    for (const targetGuest of targetGuests) {
      const liveGuest = liveGuests.get(targetGuest.id);
      if (!liveGuest) continue;
      const targetTableId = targetGuest.tableId ? (tableIdMap.get(targetGuest.tableId) || targetGuest.tableId) : null;
      if (liveGuest.tableId !== targetTableId || (liveGuest.seatNumber ?? null) !== (targetGuest.seatNumber ?? null)) {
        await apiRequest(`/events/${eventId}/guests/${targetGuest.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ tableId: targetTableId, seatNumber: targetGuest.seatNumber ?? null }),
        });
      }
    }
  }

  async function load() {
    const [tRes, gRes] = await Promise.all([
      apiRequest(`/events/${eventId}/tables`),
      apiRequest(`/events/${eventId}/guests`),
    ]);
    tables = tRes.tables;
    guests = gRes.guests;
    renderAll();
  }

  function renderAll() {
    renderPool();
    renderCanvas();
    renderDetails();
  }

  /* --------------------------- Guest pool --------------------------- */
  const poolList = document.querySelector('[data-pool-list]');
  const eventTitle = document.querySelector('.app-topbar h1');
  if (eventTitle) eventTitle.textContent = `Seating — ${event.name}`;
  const poolSearch = document.querySelector('[data-pool-search]');
  const poolFilters = document.querySelectorAll('[data-pool-filter]');
  let activeFilter = 'all';

  poolFilters.forEach((btn) => btn.addEventListener('click', () => {
    poolFilters.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.poolFilter;
    renderPool();
  }));
  poolSearch?.addEventListener('input', renderPool);

  function renderPool() {
    const q = (poolSearch?.value || '').trim().toLowerCase();
    let list = guests;
    if (activeFilter === 'unassigned') list = list.filter((g) => !g.tableId);
    else if (activeFilter === 'assigned') list = list.filter((g) => g.tableId);
    else if (activeFilter === 'vip') list = list.filter((g) => g.vip);
    if (q) list = list.filter((g) => `${g.firstName} ${g.lastName}`.toLowerCase().includes(q));

    if (list.length === 0) {
      poolList.innerHTML = `<div class="guest-mini-empty">No guests match.</div>`;
      return;
    }

    poolList.innerHTML = list.map((g) => `
      <div class="guest-pool-item" draggable="true" data-guest-id="${g.id}">
        <span class="name">${g.firstName} ${g.lastName}${g.vip ? ' <span class="vip-badge">VIP</span>' : ''}</span>
        ${g.tableId ? `<button type="button" data-unassign="${g.id}">Unseat</button>` : ''}
      </div>
    `).join('');

    poolList.querySelectorAll('[data-guest-id]').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/guest-id', item.dataset.guestId);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
    });
    poolList.querySelectorAll('[data-unassign]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        pushHistory();
        await apiRequest(`/events/${eventId}/guests/${btn.dataset.unassign}`, { method: 'PATCH', body: JSON.stringify({ tableId: null, seatNumber: null }) });
        await load();
      });
    });
  }

  /* --------------------------- Canvas / tables --------------------------- */
  function renderCanvas() {
    canvas.style.transform = `scale(${zoom})`;

    if (tables.length === 0) {
      canvas.innerHTML = `<div class="canvas-empty-hint">No tables yet. Add one from the <a href="tables.html?event=${eventId}">Tables</a> page, then drag guests here.</div>`;
      return;
    }

    canvas.innerHTML = tables.map((t) => {
      const size = SHAPE_SIZE[t.shape] || SHAPE_SIZE.round;
      const filled = guests.filter((g) => g.tableId === t.id).length;
      const over = filled > t.capacity;
      return `
        <div class="table-node ${t.shape} ${t.id === selectedTableId ? 'selected' : ''} ${over ? 'over-capacity' : ''}"
             style="left:${t.x}px; top:${t.y}px; width:${size.w}px; height:${size.h}px;"
             data-table-node="${t.id}">
          <div class="table-node-label">
            <strong>${t.name}</strong>
            <span>${filled} / ${t.capacity}</span>
          </div>
        </div>`;
    }).join('');

    canvas.querySelectorAll('[data-table-node]').forEach((node) => {
      const tableId = node.dataset.tableNode;

      node.addEventListener('click', () => {
        if (node.dataset.wasDragged === 'true') { node.dataset.wasDragged = 'false'; return; }
        selectedTableId = selectedTableId === tableId ? null : tableId;
        renderCanvas(); renderDetails();
      });

      node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('drag-over'); });
      node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
      node.addEventListener('drop', async (e) => {
        e.preventDefault();
        node.classList.remove('drag-over');
        const guestId = e.dataTransfer.getData('text/guest-id');
        if (!guestId) return;
        const table = tables.find((t) => t.id === tableId);
        const filled = guests.filter((g) => g.tableId === tableId).length;
        if (filled >= table.capacity) { toast(`${table.name} is already full.`, 'error'); return; }
        pushHistory();
        await apiRequest(`/events/${eventId}/guests/${guestId}`, { method: 'PATCH', body: JSON.stringify({ tableId, seatNumber: filled + 1 }) });
        await load();
      });

      // Reposition via pointer drag (separate from HTML5 guest drag-and-drop).
      let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0;
      node.addEventListener('mousedown', (e) => {
        if (tables.find((t) => t.id === tableId)?.locked) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        const t = tables.find((t) => t.id === tableId);
        originX = t.x; originY = t.y;
        node.style.cursor = 'grabbing';
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        node.dataset.wasDragged = 'true';
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        node.style.left = `${originX + dx}px`;
        node.style.top = `${originY + dy}px`;
      });
      document.addEventListener('mouseup', async (e) => {
        if (!dragging) return;
        dragging = false;
        node.style.cursor = 'grab';
        const dx = Math.round((e.clientX - startX) / zoom);
        const dy = Math.round((e.clientY - startY) / zoom);
        if (dx === 0 && dy === 0) return;
        const table = tables.find((t) => t.id === tableId);
        pushHistory();
        await apiRequest(`/events/${eventId}/tables/${tableId}`, { method: 'PATCH', body: JSON.stringify({ x: table.x + dx, y: table.y + dy }) });
        await load();
      });
    });
  }

  /* --------------------------- Detail panel --------------------------- */
  const detailBody = document.querySelector('[data-detail-body]');

  function renderDetails() {
    if (!selectedTableId) {
      detailBody.innerHTML = `<div class="detail-empty">Select a table to see who's seated there.</div>` + renderAssignFallback();
      wireAssignFallback();
      return;
    }
    const table = tables.find((t) => t.id === selectedTableId);
    if (!table) { selectedTableId = null; renderDetails(); return; }
    const seated = guests.filter((g) => g.tableId === table.id);

    detailBody.innerHTML = `
      <h4>${table.name}</h4>
      <p class="field-hint">${table.shape.charAt(0).toUpperCase() + table.shape.slice(1)} \u00b7 Capacity ${table.capacity}</p>
      <div class="seat-list">
        ${seated.length === 0
          ? `<div class="guest-mini-empty">No guests seated yet.</div>`
          : seated.map((g) => `
            <div class="seat-list-item">
              <span>${g.firstName} ${g.lastName}</span>
              <button type="button" data-remove-seat="${g.id}">Remove</button>
            </div>`).join('')}
      </div>
      ${renderAssignFallback()}
    `;

    detailBody.querySelectorAll('[data-remove-seat]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        pushHistory();
        await apiRequest(`/events/${eventId}/guests/${btn.dataset.removeSeat}`, { method: 'PATCH', body: JSON.stringify({ tableId: null, seatNumber: null }) });
        await load();
      });
    });
    wireAssignFallback();
  }

  function renderAssignFallback() {
    const unassigned = guests.filter((g) => !g.tableId);
    return `
      <div class="assign-fallback">
        <p class="field-hint" style="margin-bottom:10px;">Accessible assignment (no drag required)</p>
        <select data-assign-guest>
          <option value="">Select a guest\u2026</option>
          ${unassigned.map((g) => `<option value="${g.id}">${g.firstName} ${g.lastName}</option>`).join('')}
        </select>
        <select data-assign-table>
          <option value="">Select a table\u2026</option>
          ${tables.map((t) => `<option value="${t.id}" ${t.id === selectedTableId ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary btn-sm btn-block" data-assign-confirm>Assign Guest</button>
      </div>`;
  }

  function wireAssignFallback() {
    detailBody.querySelector('[data-assign-confirm]')?.addEventListener('click', async () => {
      const guestId = detailBody.querySelector('[data-assign-guest]').value;
      const tableId = detailBody.querySelector('[data-assign-table]').value;
      if (!guestId || !tableId) { toast('Choose a guest and a table.', 'error'); return; }
      const table = tables.find((t) => t.id === tableId);
      const filled = guests.filter((g) => g.tableId === tableId).length;
      if (filled >= table.capacity) { toast(`${table.name} is already full.`, 'error'); return; }
      pushHistory();
      await apiRequest(`/events/${eventId}/guests/${guestId}`, { method: 'PATCH', body: JSON.stringify({ tableId, seatNumber: filled + 1 }) });
      selectedTableId = tableId;
      await load();
      toast('Guest assigned.', 'success');
    });
  }

  /* --------------------------- Toolbar --------------------------- */
  document.querySelector('[data-zoom-in]')?.addEventListener('click', () => { zoom = Math.min(1.6, zoom + 0.1); renderCanvas(); });
  document.querySelector('[data-zoom-out]')?.addEventListener('click', () => { zoom = Math.max(0.5, zoom - 0.1); renderCanvas(); });
  document.querySelector('[data-zoom-reset]')?.addEventListener('click', () => { zoom = 1; canvas.parentElement.scrollTo(0, 0); renderCanvas(); });

  document.querySelector('[data-undo]')?.addEventListener('click', async () => {
    if (undoStack.length === 0) return;
    redoStack.push(snapshot());
    const state = undoStack.pop();
    restore(state);
    try {
      await persistSnapshot(state);
      await load();
      toast('Undo applied.', 'success');
    } catch (err) {
      toast(err.message || 'Undo could not be saved.', 'error');
      await load();
    }
  });
  document.querySelector('[data-redo]')?.addEventListener('click', async () => {
    if (redoStack.length === 0) return;
    undoStack.push(snapshot());
    const state = redoStack.pop();
    restore(state);
    try {
      await persistSnapshot(state);
      await load();
      toast('Redo applied.', 'success');
    } catch (err) {
      toast(err.message || 'Redo could not be saved.', 'error');
      await load();
    }
  });

  document.querySelector('[data-auto-arrange]')?.addEventListener('click', async () => {
    if (tables.length === 0) { toast('Add a table first.', 'error'); return; }
    pushHistory();
    const fill = new Map(tables.map((t) => [t.id, guests.filter((g) => g.tableId === t.id).length]));
    let ti = 0;
    for (const g of guests.filter((g) => !g.tableId)) {
      let attempts = 0;
      while (attempts < tables.length) {
        const table = tables[ti % tables.length];
        const count = fill.get(table.id) || 0;
        if (count < table.capacity) {
          await apiRequest(`/events/${eventId}/guests/${g.id}`, { method: 'PATCH', body: JSON.stringify({ tableId: table.id, seatNumber: count + 1 }) });
          fill.set(table.id, count + 1);
          ti += 1;
          break;
        }
        ti += 1; attempts += 1;
      }
    }
    toast('Auto-arrange complete.', 'success');
    await load();
  });

  document.querySelector('[data-save-layout]')?.addEventListener('click', () => toast('Seating changes are saved automatically.', 'success'));

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') { selectedTableId = null; renderCanvas(); renderDetails(); }
    if (e.key === 'Delete' && selectedTableId) {
      if (!window.confirm('Delete this table? Seated guests will become unassigned.')) return;
      pushHistory();
      await apiRequest(`/events/${eventId}/tables/${selectedTableId}`, { method: 'DELETE' });
      selectedTableId = null;
      await load();
    }
  });

  load();
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  initSeatingPage();
});
