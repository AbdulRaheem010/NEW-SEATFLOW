// SeatFlow — app.js
// Entry point loaded on every public/marketing page.
// Keeps the public navigation aware of the authenticated session.

import { initMobileDrawer, initFaqAccordion, initHeaderScrollState } from './navigation.js';

function initAuthenticatedNavigation() {
  const token = localStorage.getItem('seatflow_token');
  if (!token) return;

  const isDashboardPage = window.location.pathname.includes('/dashboard/');

  // On public pages, send authenticated users to their dashboard instead of
  // showing actions that imply they need to log in or create an account.
  if (!isDashboardPage) {
    document.querySelectorAll('a.brand').forEach((brand) => {
      brand.href = 'dashboard/index.html';
    });

    document.querySelectorAll('.nav-actions').forEach((actions) => {
      const loginLink = actions.querySelector('.login-link');
      const createLink = actions.querySelector('a[href="register.html"]');

      if (loginLink) {
        loginLink.textContent = 'Dashboard';
        loginLink.href = 'dashboard/index.html';
      }

      if (createLink) {
        createLink.textContent = 'Dashboard';
        createLink.href = 'dashboard/index.html';
        createLink.classList.add('dashboard-action-link');
        createLink.setAttribute('aria-hidden', 'true');
        createLink.style.display = 'none';
      }
    });

    document.querySelectorAll('.drawer-actions').forEach((actions) => {
      const loginLink = actions.querySelector('a[href="login.html"]');
      const createLink = actions.querySelector('a[href="register.html"]');

      if (loginLink) {
        loginLink.textContent = 'Dashboard';
        loginLink.href = 'dashboard/index.html';
      }

      if (createLink) {
        createLink.textContent = 'Dashboard';
        createLink.href = 'dashboard/index.html';
        createLink.style.display = 'none';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthenticatedNavigation();
  initMobileDrawer();
  initFaqAccordion();
  initHeaderScrollState();
});
