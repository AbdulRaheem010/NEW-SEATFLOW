import { API_BASE_URL } from './api.js';

const params = new URLSearchParams(window.location.search);
const slug = params.get('event');
const nameEl = document.querySelector('[data-event-name]');
const detailsEl = document.querySelector('[data-event-details]');
const form = document.querySelector('[data-lookup-form]');
const resultEl = document.querySelector('[data-result]');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadEvent() {
  if (!slug) throw new Error('This event link is missing its event code.');
  const res = await fetch(`${API_BASE_URL.replace('/api/v1','')}/api/v1/public/events/${encodeURIComponent(slug)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Event not found.');
  nameEl.textContent = data.event.name;
  detailsEl.textContent = [data.event.date, data.event.venue].filter(Boolean).join(' · ');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  resultEl.innerHTML = '<p>Searching…</p>';
  try {
    const res = await fetch(`${API_BASE_URL.replace('/api/v1','')}/api/v1/public/events/${encodeURIComponent(slug)}/guest-lookup?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Guest not found.');
    const guest = data.guest;
    resultEl.innerHTML = `
      <div style="padding:24px;border:1px solid var(--border);border-radius:16px;text-align:center;">
        <p style="margin:0 0 6px;">Welcome, <strong>${escapeHtml(guest.firstName)} ${escapeHtml(guest.lastName)}</strong></p>
        <h2 style="margin:10px 0;">${escapeHtml(guest.tableName || 'Table not assigned')}</h2>
        <p>${guest.seatNumber ? `Seat ${escapeHtml(guest.seatNumber)}` : 'Your seat number has not been assigned yet.'}</p>
        ${guest.tablemates?.length ? `<p style="margin-top:16px;"><strong>Tablemates</strong><br>${guest.tablemates.map(escapeHtml).join('<br>')}</p>` : ''}
      </div>`;
  } catch (err) {
    resultEl.innerHTML = `<p style="color:#b42318;">${escapeHtml(err.message)}</p>`;
  }
});

loadEvent().catch((err) => {
  nameEl.textContent = 'Event unavailable';
  detailsEl.textContent = err.message;
  form.style.display = 'none';
});