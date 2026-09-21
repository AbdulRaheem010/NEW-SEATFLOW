// SeatFlow — navigation.js
// Handles the mobile drawer (hamburger) menu and the sticky-header FAQ-style
// accordion pattern reused across marketing pages.

export function initMobileDrawer() {
  const toggle = document.querySelector('[data-drawer-toggle]');
  const drawer = document.querySelector('[data-drawer]');
  if (!toggle || !drawer) return;

  const closeBtn = drawer.querySelector('[data-drawer-close]');
  const overlay = drawer.querySelector('.drawer-overlay');

  const open = () => {
    drawer.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    drawer.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

export function initFaqAccordion() {
  const items = document.querySelectorAll('[data-faq-item]');
  items.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!question || !answer) return;

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.faq-answer').style.maxHeight = null;
        other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

export function initHeaderScrollState() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => {
    header.style.boxShadow = window.scrollY > 4 ? 'var(--shadow-sm)' : 'none';
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
