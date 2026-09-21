// SeatFlow — guests.js
// Powers dashboard/guests.html.

import { requireAuth } from './auth.js';
import { apiRequest } from './api.js';
import { isRequired, isValidEmail, setFieldError, toast, debounce } from './utils.js';
import { initImportModal } from './import.js';

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

function initials(g) {
  return `${g.firstName?.[0] || ''}${g.lastName?.[0] || ''}`.toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

async function initGuestsPage() {
  const tableBody = document.querySelector('[data-guest-table-body]');
  if (!tableBody) return;

  const event = await currentEvent();
  const eventId = event?.id || null;
  const contextLinks = { tables: document.querySelector('a[href="tables.html"]'), seating: document.querySelector('a[href="seating.html"]') };
  if (eventId) Object.values(contextLinks).forEach((link) => { if (link) link.href = `${link.getAttribute('href')}?event=${encodeURIComponent(eventId)}`; });
  if (!eventId) {
    document.querySelector('[data-guests-shell]').innerHTML = `
      <div class="empty-state">
        <h3>No event selected yet</h3>
        <p>Create your first event, then come back here to manage its guest list.</p>
        <div class="empty-actions"><a href="create-event.html" class="btn btn-primary">Create Event</a></div>
      </div>`;
    return;
  }

  document.querySelectorAll('[data-event-name]').forEach((el) => { el.textContent = event.name || 'Event'; });

  let guests = [];

  async function loadGuests() {
    const res = await apiRequest(`/events/${eventId}/guests`);
    guests = res.guests;
    render();
  }

  const searchInput = document.querySelector('[data-guest-search]');

  function render() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const filtered = q
      ? guests.filter((g) => `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) || (g.email || '').toLowerCase().includes(q))
      : guests;

    if (filtered.length === 0) {
      tableBody.closest('.data-table-wrap').style.display = 'none';
      document.querySelector('[data-guest-empty]').style.display = 'block';
      return;
    }
    tableBody.closest('.data-table-wrap').style.display = 'block';
    document.querySelector('[data-guest-empty]').style.display = 'none';

    tableBody.innerHTML = filtered.map((g) => `
      <tr data-guest-row="${g.id}">
        <td>
          <div class="guest-name-cell">
            <span class="guest-avatar">${initials(g)}</span>
            <span>${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}${g.vip ? '<span class="vip-badge">VIP</span>' : ''}</span>
          </div>
        </td>
        <td>${escapeHtml(g.group || '\u2014')}</td>
        <td>${escapeHtml(g.meal || '\u2014')}</td>
        <td>${escapeHtml(g.tableName || (g.tableId ? 'Assigned' : '\u2014'))}</td>
        <td>${g.seatNumber || '\u2014'}</td>
        <td><span class="status-dot ${g.checkedIn ? 'in' : ''}">${g.checkedIn ? 'Checked in' : 'Not arrived'}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit-guest="${g.id}">Edit</button>
            ${!g.checkedIn ? `<button type="button" data-checkin-guest="${g.id}">Check in</button>` : ''}
            <button type="button" class="danger" data-delete-guest="${g.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  searchInput?.addEventListener('input', debounce(render, 150));

  /* Add / edit guest modal */
  const guestModal = document.querySelector('[data-guest-modal]');
  const guestForm = document.querySelector('[data-guest-form]');
  const guestModalTitle = document.querySelector('[data-guest-modal-title]');
  let editingGuestId = null;

  function openGuestModal(guest = null) {
    editingGuestId = guest?.id || null;
    guestModalTitle.textContent = guest ? 'Edit Guest' : 'Add Guest';
    guestForm.reset();
    if (guest) {
      guestForm.querySelector('#guestFirstName').value = guest.firstName || '';
      guestForm.querySelector('#guestLastName').value = guest.lastName || '';
      guestForm.querySelector('#guestEmail').value = guest.email || '';
      guestForm.querySelector('#guestPhone').value = guest.phone || '';
      guestForm.querySelector('#guestGroup').value = guest.group || '';
      guestForm.querySelector('#guestVip').checked = !!guest.vip;
      guestForm.querySelector('#guestMeal').value = guest.meal || '';
      guestForm.querySelector('#guestNotes').value = guest.notes || '';
    }
    guestModal.classList.add('open');
  }
  function closeGuestModal() { guestModal.classList.remove('open'); editingGuestId = null; }

  document.querySelector('[data-add-guest]')?.addEventListener('click', () => openGuestModal());
  guestModal.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeGuestModal));

  guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = guestForm.querySelector('#guestFirstName');
    const lastName = guestForm.querySelector('#guestLastName');
    const email = guestForm.querySelector('#guestEmail');
    let valid = true;

    if (!isRequired(firstName.value)) { setFieldError(firstName, 'Required.'); valid = false; } else setFieldError(firstName, null);
    if (!isRequired(lastName.value)) { setFieldError(lastName, 'Required.'); valid = false; } else setFieldError(lastName, null);
    if (email.value && !isValidEmail(email.value)) { setFieldError(email, 'Enter a valid email.'); valid = false; } else setFieldError(email, null);
    if (!valid) return;

    const payload = {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim(),
      phone: guestForm.querySelector('#guestPhone').value.trim(),
      group: guestForm.querySelector('#guestGroup').value.trim(),
      vip: guestForm.querySelector('#guestVip').checked,
      meal: guestForm.querySelector('#guestMeal').value.trim(),
      notes: guestForm.querySelector('#guestNotes').value.trim(),
    };

    try {
      if (editingGuestId) {
        await apiRequest(`/events/${eventId}/guests/${editingGuestId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Guest updated.', 'success');
      } else {
        await apiRequest(`/events/${eventId}/guests`, { method: 'POST', body: JSON.stringify(payload) });
        toast('Guest added successfully.', 'success');
      }
      closeGuestModal();
      loadGuests();
    } catch (err) {
      toast('Could not save this guest.', 'error');
    }
  });

  /* Delete confirmation */
  const deleteModal = document.querySelector('[data-delete-modal]');
  let pendingDeleteId = null;
  function openDeleteModal(id) { pendingDeleteId = id; deleteModal.classList.add('open'); }
  function closeDeleteModal() { pendingDeleteId = null; deleteModal.classList.remove('open'); }
  deleteModal.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', closeDeleteModal));
  deleteModal.querySelector('[data-confirm-delete]').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      await apiRequest(`/events/${eventId}/guests/${pendingDeleteId}`, { method: 'DELETE' });
      toast('Guest removed.', 'success');
      closeDeleteModal();
      loadGuests();
    } catch (err) {
      toast('Could not remove this guest.', 'error');
    }
  });

  /* Row action delegation */
  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-guest]');
    const checkinBtn = e.target.closest('[data-checkin-guest]');
    const deleteBtn = e.target.closest('[data-delete-guest]');

    if (editBtn) {
      const guest = guests.find((g) => g.id === editBtn.dataset.editGuest);
      openGuestModal(guest);
    } else if (checkinBtn) {
      try {
        await apiRequest(`/events/${eventId}/guests/${checkinBtn.dataset.checkinGuest}/check-in`, { method: 'POST' });
        toast('Guest checked in.', 'success');
        loadGuests();
      } catch (err) {
        toast('Could not check in this guest.', 'error');
      }
    } else if (deleteBtn) {
      openDeleteModal(deleteBtn.dataset.deleteGuest);
    }
  });

  /* Export */
  document.querySelector('[data-export-guests]')?.addEventListener('click', () => {
    const header = 'First Name,Last Name,Email,Phone,Group,VIP,Meal,Table,Seat,Checked In\n';
    const rows = guests.map((g) => [g.firstName, g.lastName, g.email, g.phone, g.group, g.vip ? 'Yes' : 'No', g.meal, g.tableName || '', g.seatNumber || '', g.checkedIn ? 'Yes' : 'No']
      .map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'seatflow-guest-list.csv'; a.click();
    URL.revokeObjectURL(url);
  });

  /* Import modal */
  const importModal = document.querySelector('[data-import-modal]');
  document.querySelector('[data-open-import]')?.addEventListener('click', () => importModal.classList.add('open'));
  importModal?.querySelectorAll('[data-modal-close]').forEach((btn) => btn.addEventListener('click', () => importModal.classList.remove('open')));
  initImportModal({ modalEl: importModal, eventId, onImported: loadGuests });

  loadGuests();
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  initGuestsPage();
});
