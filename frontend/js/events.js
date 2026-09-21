// SeatFlow — events.js
// Powers dashboard/events.html (search/filter/sort) and
// dashboard/create-event.html (the multi-step wizard).

import { requireAuth } from './auth.js';
import { apiRequest } from './api.js';
import { isRequired, uid, toast, debounce, setFieldError, formatDate } from './utils.js';

/* ------------------------------------------------------------------ */
/* Event list page                                                      */
/* ------------------------------------------------------------------ */
async function initEventsListPage() {
  const listEl = document.querySelector('[data-event-list]');
  if (!listEl) return;

  const { events } = await apiRequest('/events');
  const searchInput = document.querySelector('[data-event-search]');
  const statusFilter = document.querySelector('[data-status-filter]');
  const sortSelect = document.querySelector('[data-sort-select]');

  function render() {
    let items = [...events];

    const q = (searchInput?.value || '').trim().toLowerCase();
    if (q) items = items.filter((e) => e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q));

    const status = statusFilter?.value;
    if (status && status !== 'all') items = items.filter((e) => e.status === status);

    const sort = sortSelect?.value || 'date-asc';
    items.sort((a, b) => {
      if (sort === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sort === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      if (sort === 'guests-desc') return b.guestCount - a.guestCount;
      return 0;
    });

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>No events match your search.</h3>
          <p>Try a different name, venue, or clear your filters.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = items.map((e) => `
      <div class="event-row-card">
        <div class="event-row-top">
          <div>
            <h4>${e.name}</h4>
            <p class="event-meta">${formatDate(e.date)} \u00b7 ${e.venue}</p>
          </div>
          <span class="status-pill ${e.status === 'live' ? 'live' : 'draft'}">${e.status === 'live' ? 'Live' : 'Draft'}</span>
        </div>
        <div class="event-stats-row">
          <div><strong>${e.guestCount}</strong>Guests</div>
          <div><strong>${e.guestCount ? Math.round((e.assignedCount / e.guestCount) * 100) : 0}%</strong>Assigned</div>
          <div><strong>${e.qrActive ? 'Active' : 'Inactive'}</strong>QR Status</div>
        </div>
        <a href="guests.html?event=${e.id}" class="btn btn-primary btn-sm btn-block">Manage Event</a>
      </div>
    `).join('');
  }

  render();
  searchInput?.addEventListener('input', debounce(render, 150));
  statusFilter?.addEventListener('change', render);
  sortSelect?.addEventListener('change', render);
}

/* ------------------------------------------------------------------ */
/* Create-event wizard                                                  */
/* ------------------------------------------------------------------ */
const WIZARD_STEPS = ['details', 'guests', 'tables', 'seating', 'branding', 'guest-experience', 'publish'];

function initCreateEventWizard() {
  const wizardEl = document.querySelector('[data-wizard]');
  if (!wizardEl) return;

  const wizardState = { details: {}, guests: [] };
  let currentStep = 0;

  const progressEl = document.querySelector('[data-wizard-progress]');
  const panels = document.querySelectorAll('[data-wizard-panel]');
  const backBtn = document.querySelector('[data-wizard-back]');
  const nextBtn = document.querySelector('[data-wizard-next]');
  const publishBtn = document.querySelector('[data-wizard-publish]');

  function renderProgress() {
    progressEl.innerHTML = WIZARD_STEPS.map((step, i) => {
      const label = { details: 'Event Details', guests: 'Guests', tables: 'Tables', seating: 'Seating', branding: 'Branding', 'guest-experience': 'Guest Experience', publish: 'Publish' }[step];
      const state = i === currentStep ? 'active' : i < currentStep ? 'done' : '';
      return `<div class="wizard-step ${state}"><span class="step-circle">${i < currentStep ? '\u2713' : i + 1}</span><span class="label">${label}</span></div>`;
    }).join('');
  }

  function renderPanels() {
    panels.forEach((panel, i) => {
      panel.style.display = i === currentStep ? 'block' : 'none';
    });
    backBtn.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    nextBtn.style.display = currentStep === WIZARD_STEPS.length - 1 ? 'none' : 'inline-flex';
    publishBtn.style.display = currentStep === WIZARD_STEPS.length - 1 ? 'inline-flex' : 'none';
    if (currentStep === WIZARD_STEPS.length - 1) renderSummary();
  }

  function goTo(step) {
    currentStep = step;
    renderProgress();
    renderPanels();
    wizardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateDetailsStep() {
    const name = document.querySelector('#eventName');
    const type = document.querySelector('#eventType');
    const date = document.querySelector('#eventDate');
    const venue = document.querySelector('#eventVenue');
    let valid = true;

    if (!isRequired(name.value)) { setFieldError(name, 'Event name is required.'); valid = false; } else setFieldError(name, null);
    if (!isRequired(type.value)) { setFieldError(type, 'Choose an event type.'); valid = false; } else setFieldError(type, null);
    if (!isRequired(date.value)) { setFieldError(date, 'Event date is required.'); valid = false; } else setFieldError(date, null);
    if (!isRequired(venue.value)) { setFieldError(venue, 'Venue is required.'); valid = false; } else setFieldError(venue, null);

    if (valid) {
      wizardState.details = {
        name: name.value,
        type: type.value,
        date: date.value,
        startTime: document.querySelector('#eventStart').value,
        endTime: document.querySelector('#eventEnd').value,
        venue: venue.value,
        description: document.querySelector('#eventDescription').value,
        timezone: document.querySelector('#eventTimezone').value,
      };
    }
    return valid;
  }

  nextBtn.addEventListener('click', () => {
    if (currentStep === 0 && !validateDetailsStep()) { toast('Please fill in the required event details.', 'error'); return; }
    goTo(Math.min(currentStep + 1, WIZARD_STEPS.length - 1));
  });

  backBtn.addEventListener('click', () => goTo(Math.max(currentStep - 1, 0)));

  progressEl.addEventListener('click', (e) => {
    const stepEl = e.target.closest('.wizard-step');
    if (!stepEl) return;
    const idx = [...progressEl.children].indexOf(stepEl);
    if (idx <= currentStep) goTo(idx); // only allow jumping backward
  });

  /* Step 2 — guest add (lightweight demo; full CRUD ships in Phase 3) */
  const guestForm = document.querySelector('[data-guest-add-form]');
  const guestListEl = document.querySelector('[data-wizard-guest-list]');

  function renderGuestList() {
    if (wizardState.guests.length === 0) {
      guestListEl.innerHTML = `<div class="guest-mini-empty">No guests added yet.</div>`;
      return;
    }
    guestListEl.innerHTML = wizardState.guests.map((g) => `
      <div class="guest-mini-row">
        <span>${g.firstName} ${g.lastName}</span>
        <button type="button" data-remove-guest="${g.id}">Remove</button>
      </div>
    `).join('');
  }

  guestForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const firstInput = guestForm.querySelector('#wizardGuestFirst');
    const lastInput = guestForm.querySelector('#wizardGuestLast');
    if (!isRequired(firstInput.value) || !isRequired(lastInput.value)) {
      toast('Enter a first and last name.', 'error');
      return;
    }
    wizardState.guests.push({ id: uid('guest'), firstName: firstInput.value.trim(), lastName: lastInput.value.trim() });
    firstInput.value = '';
    lastInput.value = '';
    firstInput.focus();
    renderGuestList();
  });

  guestListEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-guest]');
    if (!btn) return;
    wizardState.guests = wizardState.guests.filter((g) => g.id !== btn.dataset.removeGuest);
    renderGuestList();
  });

  /* Step 7 — summary + publish */
  function renderSummary() {
    const summaryEl = document.querySelector('[data-wizard-summary]');
    if (!summaryEl) return;
    const d = wizardState.details;
    summaryEl.innerHTML = `
      <div class="summary-row"><span>Event name</span><span>${d.name || '\u2014'}</span></div>
      <div class="summary-row"><span>Type</span><span>${d.type || '\u2014'}</span></div>
      <div class="summary-row"><span>Date</span><span>${d.date ? formatDate(d.date) : '\u2014'}</span></div>
      <div class="summary-row"><span>Venue</span><span>${d.venue || '\u2014'}</span></div>
      <div class="summary-row"><span>Guests added</span><span>${wizardState.guests.length}</span></div>
    `;
  }

  publishBtn?.addEventListener('click', async () => {
    if (!isRequired(wizardState.details.name)) {
      toast('Complete the event details step before publishing.', 'error');
      goTo(0);
      return;
    }
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing\u2026';

    try {
      const slug = wizardState.details.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { event } = await apiRequest('/events', {
        method: 'POST',
        body: JSON.stringify({ ...wizardState.details, slug, guestCount: wizardState.guests.length, status: 'draft' }),
      });
      for (const g of wizardState.guests) {
        await apiRequest(`/events/${event.id}/guests`, { method: 'POST', body: JSON.stringify(g) });
      }
      toast('Event created successfully.', 'success');
      setTimeout(() => { window.location.href = 'events.html'; }, 600);
    } catch (err) {
      toast('Something went wrong publishing your event.', 'error');
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publish Event';
    }
  });

  renderProgress();
  renderPanels();
  renderGuestList();
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  initEventsListPage();
  initCreateEventWizard();
});
