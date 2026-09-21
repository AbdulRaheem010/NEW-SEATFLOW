const express = require('express');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting SeatFlow.');
}
const cors = require('cors');
const { errorHandler, notFoundHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const publicRoutes = require('./routes/public');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ name: 'SeatFlow API', status: 'ok' });
});
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/public', publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
