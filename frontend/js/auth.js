// SeatFlow — auth.js
// Client-side validation and live SeatFlow authentication for login, register and forgot-password.

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

async function initLoginForm() {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#email');
    const password = form.querySelector('#password');
    let valid = true;

    if (!isValidEmail(email.value)) { setFieldError(email, 'Enter a valid email address.'); valid = false; }
    else setFieldError(email, null);

    if (!isRequired(password.value)) { setFieldError(password, 'Enter your password.'); valid = false; }
    else setFieldError(password, null);

    if (!valid) { showStatus(form, 'Please fix the highlighted fields.', 'error'); return; }

    setLoading(submitBtn, true, 'Signing in…', 'Log in');
    showStatus(form, '', '');

    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.value.trim(), password: password.value }),
      });

      localStorage.setItem('seatflow_token', result.token);
      setCurrentUser(result.user);
      showStatus(form, 'Signed in — redirecting…', 'success');
      window.location.href = 'dashboard/index.html';
    } catch (error) {
      showStatus(form, error.message || 'Unable to sign in. Please try again.', 'error');
    } finally {
      setLoading(submitBtn, false, 'Signing in…', 'Log in');
    }
  });
}

async function initRegisterForm() {
  const form = document.querySelector('[data-register-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
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
      setFieldError(confirmPassword, 'Passwords don’t match.'); valid = false;
    } else setFieldError(confirmPassword, null);

    if (!valid) { showStatus(form, 'Please fix the highlighted fields.', 'error'); return; }

    setLoading(submitBtn, true, 'Creating account…', 'Create account');
    showStatus(form, '', '');

    try {
      const result = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          email: email.value.trim(),
          password: password.value,
        }),
      });

      localStorage.setItem('seatflow_token', result.token);
      setCurrentUser(result.user);
      showStatus(form, 'Account created — redirecting…', 'success');
      window.location.href = 'dashboard/index.html';
    } catch (error) {
      showStatus(form, error.message || 'Unable to create account. Please try again.', 'error');
    } finally {
      setLoading(submitBtn, false, 'Creating account…', 'Create account');
    }
  });
}

function initResetPasswordForm() {
  const form = document.querySelector('[data-reset-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  if (!token) {
    showStatus(form, 'This reset link is missing or invalid. Request a new one.', 'error');
    submitBtn.disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = form.querySelector('#password');
    const confirmPassword = form.querySelector('#confirmPassword');

    if (password.value.length < 8) {
      setFieldError(password, 'Use at least 8 characters.');
      showStatus(form, 'Please fix the highlighted fields.', 'error');
      return;
    }
    setFieldError(password, null);

    if (password.value !== confirmPassword.value) {
      setFieldError(confirmPassword, 'Passwords don’t match.');
      showStatus(form, 'Please fix the highlighted fields.', 'error');
      return;
    }
    setFieldError(confirmPassword, null);

    setLoading(submitBtn, true, 'Resetting…', 'Reset password');
    showStatus(form, '', '');

    try {
      const result = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: password.value }),
      });
      showStatus(form, result.message || 'Password reset successfully. Redirecting…', 'success');
      setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    } catch (error) {
      showStatus(form, error.message || 'Unable to reset your password. Request a new link if needed.', 'error');
    } finally {
      setLoading(submitBtn, false, 'Resetting…', 'Reset password');
    }
  });
}

function initForgotPasswordForm() {
  const form = document.querySelector('[data-forgot-form]');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('#email');

    if (!isValidEmail(email.value)) {
      setFieldError(email, 'Enter a valid email address.');
      showStatus(form, 'Please fix the highlighted fields.', 'error');
      return;
    }
    setFieldError(email, null);
    setLoading(submitBtn, true, 'Sending link…', 'Send reset link');
    showStatus(form, '', '');

    try {
      const result = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.value.trim() }),
      });
      showStatus(form, result.message || 'If an account exists, a reset link has been sent.', 'success');
    } catch (error) {
      showStatus(form, error.message || 'Unable to send reset link. Please try again.', 'error');
    } finally {
      setLoading(submitBtn, false, 'Sending link…', 'Send reset link');
    }
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
  initResetPasswordForm();
});
