// SeatFlow — dashboard.js
// Shared dashboard-shell behavior: mobile sidebar drawer + overview cards.

import { requireAuth } from './auth.js';
import { apiRequest } from './api.js';
import { getCurrentUser, logoutUser } from './state.js';
import { formatDate } from './utils.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function initDashboardBrand() {
  // The SeatFlow logo inside authenticated pages stays inside the app.
  document.querySelectorAll('a.brand').forEach((brand) => {
    brand.href = 'index.html';
  });
}

function initSidebarDrawer() {
  const toggle = document.querySelector('[data-sidebar-toggle]');
  const sidebar = document.querySelector('.app-sidebar');
  const overlay = document.querySelector('[data-sidebar-overlay]');
  if (!toggle || !sidebar) return;

  const open = () => { sidebar.classList.add('open'); overlay?.classList.add('open'); };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('open'); };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? close() : open();
  });
  overlay?.addEventListener('click', close);
}

function initUserMeta() {
  const user = getCurrentUser();
  const nameEls = document.querySelectorAll('[data-user-name]');
  const initialEls = document.querySelectorAll('[data-user-initial]');
  if (user) {
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || 'Organizer';
    nameEls.forEach((el) => { el.textContent = displayName; });
    initialEls.forEach((el) => { el.textContent = displayName.charAt(0).toUpperCase(); });
  }

  document.querySelectorAll('[data-logout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      logoutUser();
      localStorage.removeItem('seatflow_token');
      window.location.href = '../login.html';
    });
  });
}

async function renderOverview() {
  const grid = document.querySelector('[data-stat-grid]');
  if (!grid) return;

  const { events } = await apiRequest('/events');
  const totalGuests = events.reduce((sum, e) => sum + (e.guestCount || 0), 0);
  const checkedIn = events.reduce((sum, e) => sum + (e.checkedInCount || 0), 0);
  const upcoming = events.filter((e) => new Date(e.date) >= new Date(new Date().toDateString()));
  const activeQr = events.filter((e) => e.qrActive).length;

  grid.innerHTML = `
    <div class="stat-card"><p class="stat-label">Total Events</p><p class="stat-value">${events.length}</p></div>
    <div class="stat-card"><p class="stat-label">Upcoming Events</p><p class="stat-value">${upcoming.length}</p></div>
    <div class="stat-card"><p class="stat-label">Total Guests</p><p class="stat-value">${totalGuests}</p></div>
    <div class="stat-card"><p class="stat-label">Checked In</p><p class="stat-value">${checkedIn}</p><p class="stat-sub">across all live events</p></div>
    <div class="stat-card"><p class="stat-label">Active QR Codes</p><p class="stat-value">${activeQr}</p></div>
    <div class="stat-card"><p class="stat-label">Current Plan</p><p class="stat-value" style="font-size:1.3rem;">${escapeHtml(getCurrentUser()?.plan || "Free")}</p></div>
  `;

  const recentList = document.querySelector('[data-recent-events]');
  if (recentList) {
    if (events.length === 0) {
      recentList.innerHTML = `<div class="guest-mini-empty">No events yet.</div>`;
    } else {
      recentList.innerHTML = events.slice(0, 4).map((e) => `
        <div class="activity-row">
          <span class="activity-dot"></span>
          <div>
            <strong>${escapeHtml(e.name)}</strong>
            <time>${escapeHtml(formatDate(e.date))} · ${escapeHtml(e.venue)}</time>
          </div>
        </div>
      `).join('');
    }
  }

  const activityFeed = document.querySelector('[data-activity-feed]');
  if (activityFeed) {
    activityFeed.innerHTML = events.length
      ? events.slice(0, 5).map((event) => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${escapeHtml(event.name)}</strong><time>${escapeHtml(formatDate(event.date))} · ${event.status === 'live' ? 'Live' : 'Draft'}</time></div></div>`).join('')
      : `<div class="guest-mini-empty">No recent activity.</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  initDashboardBrand();
  initSidebarDrawer();
  initUserMeta();
  renderOverview();
});
