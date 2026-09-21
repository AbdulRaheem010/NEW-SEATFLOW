const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function toPublicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    plan: row.plan,
  };
}

const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'firstName, lastName, email and password are all required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [firstName, lastName, email.toLowerCase(), passwordHash]
  );

  const user = result.rows[0];
  res.status(201).json({ user: toPublicUser(user), token: signToken(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return res.status(401).json({ error: 'Invalid email or password.' });

  res.json({ user: toPublicUser(user), token: signToken(user) });
});

const me = asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: toPublicUser(user) });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  // Password-reset email delivery is intentionally not faked until an email provider
  // and reset-token storage are configured.
  return res.status(501).json({ error: 'Password reset is not configured yet. Please contact support.' });
});

module.exports = { register, login, me, forgotPassword };
