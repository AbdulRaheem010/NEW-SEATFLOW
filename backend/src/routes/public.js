const express = require('express');
const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { publicGuestLookup } = require('../controllers/guestController');

const router = express.Router();

// Public event summary (name, date, venue, branding) — never guest data.
router.get('/events/:slug', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT slug, name, type, date, start_time, end_time, venue, description, timezone, logo_url, theme, show_tablemates
     FROM events WHERE slug = $1 AND status = 'live'`,
    [req.params.slug]
  );
  const event = result.rows[0];
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({
    event: {
      slug: event.slug,
      name: event.name,
      type: event.type,
      date: event.date,
      startTime: event.start_time,
      endTime: event.end_time,
      venue: event.venue,
      description: event.description,
      timezone: event.timezone,
      logo: event.logo_url,
      theme: event.theme,
    },
  });
}));

// Guest seat lookup — see guestController.publicGuestLookup for the privacy rules.
router.get('/events/:slug/guest-lookup', publicGuestLookup);

module.exports = router;
