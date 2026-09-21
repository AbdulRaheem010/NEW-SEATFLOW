// SeatFlow — tables.js
// Powers dashboard/tables.html — the management list view for tables
// (the visual canvas lives in seating.js / dashboard/seating.html).

import { requireAuth } from './auth.js';
import { apiRequest } from './api.js';
import { isRequired, setFieldError, toast, uid } from './utils.js';

async function currentEvent() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('event');
  const { events = [] } = await apiRequest('/events');

  if (requested) {
    const match = events.find((e) => e.id === requested || e.slug === requested);
    if (match) return match;
  }

  return null;
}

async function initTablesPage() {
  const grid = document.querySelector('[data-table-grid]');
  if (!grid) return;

  const event = await currentEvent();
  const eventId = event?.id || null;
  const contextLinks = { guests: document.querySelector('a[href="guests.html"]'), seating: document.querySelector('a[href="seating.html"]') };
  if (eventId) Object.values(contextLinks).forEach((link) => { if (link) link.href = `${link.getAttribute('href')}?event=${encodeURIComponent(eventId)}`; });
  if (!eventId) {
    document.querySelector('[data-tables-empty]').style.display = 'block';
    return;
  }

  let tables = [];
  let guests = [];

  async function load() {
    const [tRes, gRes] = await Promise.all([
      apiRequest(`/events/${eventId}/tables`),
      apiRequest(`/events/${eventId}/guests`),
    ]);
    tables = tRes.tables;
    guests = gRes.guests;
    render();
  }

  function occupancy(tableId) {
    return guests.filter((g) => g.tableId === tableId).length;
  }

  function render() {
    if (tables.length === 0) {
      grid.style.display = 'none';
      document.querySelector('[data-tables-empty]').style.display = 'block';
      return;
    }
    grid.style.display = 'grid';
    document.querySelector('[data-tables-empty]').style.display = 'none';

    grid.innerHTML = tables.map((t) => {
      const filled = occupancy(t.id);
      const pct = t.capacity ? Math.min(100, Math.round((filled / t.capacity) * 100)) : 0;
      return `
        <div class="table-manage-card" data-table-card="${t.id}">
          <div class="tm-head">
            <div style="display:flex; gap:10px; align-items:center;">
              <span class="tm-shape-icon ${t.shape}"></span>
              <div>
                <h4>${t.name}</h4>
                <p class="tm-meta">${t.shape.charAt(0).toUpperCase() + t.shape.slice(1)}${t.locked ? ' \u00b7 Locked' : ''}</p>
              </div>
            </div>
          </div>
          <p class="tm-meta">${filled} / ${t.capacity} seated</p>
          <div class="tm-fill-bar"><span style="width:${pct}%; ${pct >= 100 ? 'background:var(--danger)' : ''}"></span></div>
          <div class="tm-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-table="${t.id}">Edit</button>
            <button type="button" class="btn btn-ghost btn-sm" data-duplicate-table="${t.id}">Duplicate</button>
            <button type="button" class="btn btn-ghost btn-sm" data-lock-table="${t.id}">${t.locked ? 'Unlock' : 'Lock'}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-delete-table="${t.id}" style="color:var(--danger);">Delete</button>
          </div>
        </div>`;
    }).join('');
  }

  /* Add / edit modal */
  const modal = document.querySelector('[data-table-modal]');
  const form = document.querySelector('[data-table-form]');
  const modalTitle = document.querySelector('[data-table-modal-title]');
  let editingId = null;

  function openModal(table = null) {
    editingId = table?.id || null;
    modalTitle.textContent = table ? 'Edit Table' : 'Add Table';
    form.reset();
    form.querySelector('#tableName').value = table?.name || `Table ${tables.length + 1}`;
    form.querySelector('#tableCapacity').value = table?.capacity || 8;
    form.querySelector('#tableShape').value = table?.shape || 'round';
    modal.classList.add('open');
  }
  function closeModal() { modal.classList.remove('open'); editingId = null; }

  document.querySelector('[data-add-table]')?.addEventListener('click', () => openModal());
  modal.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeModal));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = form.querySelector('#tableName');
    const capacityEl = form.querySelector('#tableCapacity');
    let valid = true;
    if (!isRequired(nameEl.value)) { setFieldError(nameEl, 'Required.'); valid = false; } else setFieldError(nameEl, null);
    if (!capacityEl.value || Number(capacityEl.value) < 1) { setFieldError(capacityEl, 'Enter a capacity of at least 1.'); valid = false; } else setFieldError(capacityEl, null);
    if (!valid) return;

    const payload = { name: nameEl.value.trim(), capacity: Number(capacityEl.value), shape: form.querySelector('#tableShape').value };

    try {
      if (editingId) {
        await apiRequest(`/events/${eventId}/tables/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Table updated.', 'success');
      } else {
        await apiRequest(`/events/${eventId}/tables`, { method: 'POST', body: JSON.stringify({ ...payload, x: 40 + tables.length * 20, y: 40 + tables.length * 20 }) });
        toast('Table added.', 'success');
      }
      closeModal();
      load();
    } catch (err) {
      toast('Could not save this table.', 'error');
    }
  });

  grid.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-table]');
    const dupeBtn = e.target.closest('[data-duplicate-table]');
    const lockBtn = e.target.closest('[data-lock-table]');
    const deleteBtn = e.target.closest('[data-delete-table]');

    if (editBtn) {
      openModal(tables.find((t) => t.id === editBtn.dataset.editTable));
    } else if (dupeBtn) {
      const source = tables.find((t) => t.id === dupeBtn.dataset.duplicateTable);
      if (!source) return;
      await apiRequest(`/events/${eventId}/tables`, {
        method: 'POST',
        body: JSON.stringify({ name: `${source.name} Copy`, capacity: source.capacity, shape: source.shape, x: source.x + 30, y: source.y + 30 }),
      });
      toast('Table duplicated.', 'success');
      load();
    } else if (lockBtn) {
      const table = tables.find((t) => t.id === lockBtn.dataset.lockTable);
      await apiRequest(`/events/${eventId}/tables/${table.id}`, { method: 'PATCH', body: JSON.stringify({ locked: !table.locked }) });
      load();
    } else if (deleteBtn) {
      if (!window.confirm('Remove this table? Seated guests will become unassigned.')) return;
      await apiRequest(`/events/${eventId}/tables/${deleteBtn.dataset.deleteTable}`, { method: 'DELETE' });
      toast('Table removed.', 'success');
      load();
    }
  });

  load();
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  initTablesPage();
});
