// SeatFlow — utils.js
// Small reusable helpers shared across dashboard modules.

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function isRequired(value) {
  return String(value || '').trim().length > 0;
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Show or clear a validation error on a .form-field wrapper.
 * el: the input/select/textarea. message: string to show, or falsy to clear.
 */
export function setFieldError(el, message) {
  const field = el.closest('.form-field');
  if (!field) return;
  const errorEl = field.querySelector('.form-error');
  if (message) {
    field.classList.add('invalid');
    if (errorEl) errorEl.textContent = message;
  } else {
    field.classList.remove('invalid');
  }
}

/**
 * Reusable toast notifications. Expects a #toast-stack container to exist
 * on the page (present on every dashboard page and injected on auth pages).
 */
export function toast(message, type = 'default') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast${type !== 'default' ? ' ' + type : ''}`;
  el.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
