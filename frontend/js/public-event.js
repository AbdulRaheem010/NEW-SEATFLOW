import { API_BASE_URL } from './api.js';

const params = new URLSearchParams(window.location.search);
const slug = params.get('event');
const nameEl = document.querySelector('[data-event-name]');
const submitBtn = form?.querySelector('button[type="submit"]');
const detailsEl = document.querySelector('[data-event-details]');
const form = document.querySelector('[data-lookup-form]');
const resultEl = document.querySelector('[data-result]');
let pendingName = '';

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

async function lookupGuest(name, disambiguator = '') {
  const query = new URLSearchParams({ name });
  if (disambiguator) query.set('disambiguator', disambiguator);
  const res = await fetch(`${API_BASE_URL.replace('/api/v1','')}/api/v1/public/events/${encodeURIComponent(slug)}/guest-lookup?${query}`);
  return { res, data: await res.json() };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  submitBtn?.setAttribute('disabled', 'disabled');
  resultEl.innerHTML = '<p>Searching…</p>';
  try {
    const { res, data } = await lookupGuest(name);
    if (res.status === 300 && data.needsDisambiguation) {
      pendingName = name;
      resultEl.innerHTML = `
        <div style="padding:20px;border:1px solid var(--border);border-radius:16px;">
          <p><strong>More than one guest matches that name.</strong></p>
          <p>Enter your email or group name to identify yourself.</p>
          <input class="text-input" data-disambiguator placeholder="Email or group">
          <button class="btn btn-primary btn-block" data-disambiguate style="margin-top:12px;">Continue</button>
        </div>`;
      return;
    }
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
  } finally {
    submitBtn?.removeAttribute('disabled');
  }
});

loadEvent().catch((err) => {
  nameEl.textContent = 'Event unavailable';
  detailsEl.textContent = err.message;
  form.style.display = 'none';
});
resultEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-disambiguate]');
  if (!btn) return;
  const input = resultEl.querySelector('[data-disambiguator]');
  const value = input?.value.trim();
  if (!value) return;
  btn.disabled = true;
  try {
    const { res, data } = await lookupGuest(pendingName, value);
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
    btn.disabled = false;
    resultEl.insertAdjacentHTML('beforeend', `<p style="color:#b42318;">${escapeHtml(err.message)}</p>`);
  }
});
