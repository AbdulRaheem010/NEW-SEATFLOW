// SeatFlow — app.js
// Entry point loaded on every public/marketing page.

import { initMobileDrawer, initFaqAccordion, initHeaderScrollState } from './navigation.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileDrawer();
  initFaqAccordion();
  initHeaderScrollState();
});
