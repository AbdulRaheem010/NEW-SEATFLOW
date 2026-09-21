// SeatFlow — auth.js
// Client-side validation and demo authentication for login, register and
// forgot-password. In demo mode, "signing in" just sets a local user record —
// this is the seam a real Supabase/Auth provider will replace.

import { isValidEmail, isRequired, setFieldError, toast } from './utils.js';
import { setCurrentUser, getCurrentUser } from './state.js';
import { apiRequest } from './api.js';

function showStatus(form, message, type) {
  const status = form.querySelector('.form-status');
  if (!status) return;
  status.textContent = message;
  status.className = `form-status ${type}`;
}

function setLoading(button, loading, loadingText, defaultText) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? loadingText : defaultText;
}

function initPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.closest('.password-field').querySelector('input');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'Hide' : 'Show';
    });
  });
}

function initLoginForm() {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('#email');
    const password = form.querySelector('#password');
    let valid = true;

    if (!isValidEmail(email.value)) { setFieldError(email, 'Enter a valid email address.'); valid = false; }
    else setFieldError(email, null);

    if (!isRequired(password.value)) { setFieldError(password, 'Enter your password.'); valid = false; }
    else setFieldError(password, null);

    if (!valid) { showStatus(form, 'Please fix the highlighted fields.', 'error'); return; }

    setLoading(submitBtn, true, 'Signing in\u2026', 'Log in');
    showStatus(form, '', '');

    setTimeout(() => {
      setCurrentUser({ name: email.value.split('@')[0], email: email.value });
      showStatus(form, 'Signed in \u2014 redirecting\u2026', 'success');
      setTimeout(() => { window.location.href = 'dashboard/index.html'; }, 500);
    }, 700);
  });
}

function initRegisterForm() {
  const form = document.querySelector('[data-register-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const firstName = form.querySelector('#firstName');
    const lastName = form.querySelector('#lastName');
    const email = form.querySelector('#email');
    const password = form.querySelector('#password');
    const confirmPassword = form.querySelector('#confirmPassword');
    let valid = true;

    if (!isRequired(firstName.value)) { setFieldError(firstName, 'First name is required.'); valid = false; } else setFieldError(firstName, null);
    if (!isRequired(lastName.value)) { setFieldError(lastName, 'Last name is required.'); valid = false; } else setFieldError(lastName, null);
    if (!isValidEmail(email.value)) { setFieldError(email, 'Enter a valid email address.'); valid = false; } else setFieldError(email, null);

    if (password.value.length < 8) { setFieldError(password, 'Use at least 8 characters.'); valid = false; } else setFieldError(password, null);

    if (confirmPassword.value !== password.value || !confirmPassword.value) {
      setFieldError(confirmPassword, 'Passwords don\u2019t match.'); valid = false;
    } else setFieldError(confirmPassword, null);

    if (!valid) { showStatus(form, 'Please fix the highlighted fields.', 'error'); return; }

    setLoading(submitBtn, true, 'Creating account\u2026', 'Create account');
    showStatus(form, '', '');

    setTimeout(() => {
      setCurrentUser({ name: `${firstName.value} ${lastName.value}`, email: email.value });
      showStatus(form, 'Account created \u2014 redirecting\u2026', 'success');
      setTimeout(() => { window.location.href = 'dashboard/index.html'; }, 500);
    }, 700);
  });
}

function initForgotPasswordForm() {
  const form = document.querySelector('[data-forgot-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('#email');

    if (!isValidEmail(email.value)) { setFieldError(email, 'Enter a valid email address.'); showStatus(form, 'Please fix the highlighted fields.', 'error'); return; }
    setFieldError(email, null);

    setLoading(submitBtn, true, 'Sending link\u2026', 'Send reset link');
    showStatus(form, '', '');

    setTimeout(() => {
      showStatus(form, `If an account exists for ${email.value}, a reset link is on its way.`, 'success');
      setLoading(submitBtn, false, 'Sending link\u2026', 'Send reset link');
    }, 700);
  });
}

/** Redirect signed-out visitors away from dashboard/admin pages. */
export function requireAuth() {
  if (!getCurrentUser() || !localStorage.getItem('seatflow_token')) {
    const depth = window.location.pathname.includes('/dashboard/') || window.location.pathname.includes('/admin/') ? '../' : '';
    window.location.href = `${depth}login.html`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();
  initLoginForm();
  initRegisterForm();
  initForgotPasswordForm();
});
