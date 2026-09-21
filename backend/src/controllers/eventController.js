const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');

function toPublicEvent(row, extra = {}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue,
    description: row.description,
    timezone: row.timezone,
    logo: row.logo_url,
    theme: row.theme,
    status: row.status,
    plan: row.plan,
    showTablemates: row.show_tablemates,
    anonymousLookup: row.anonymous_lookup,
    qrActive: row.qr_active,
    createdAt: row.created_at,
    ...extra,
  };
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const listEvents = asyncHandler(async (req, res) => {
  const events = await pool.query(
    `SELECT e.*,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id) AS guest_count,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id AND g.table_id IS NOT NULL) AS assigned_count,
            (SELECT COUNT(*) FROM guests g WHERE g.event_id = e.id AND g.checked_in) AS checked_in_count
     FROM events e WHERE e.owner_id = $1 ORDER BY e.date ASC`,
    [req.user.id]
  );

  res.json({
    events: events.rows.map((row) =>
      toPublicEvent(row, {
        guestCount: Number(row.guest_count),
        assignedCount: Number(row.assigned_count),
        checkedInCount: Number(row.checked_in_count),
      })
    ),
  });
});

const getEvent = asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM events WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
  const event = result.rows[0];
  if (!event) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: toPublicEvent(event) });
});

const createEvent = asyncHandler(async (req, res) => {
  const { name, type, date, startTime, endTime, venue, description, timezone, plan } = req.body;
  if (!name || !date || !venue) {
    return res.status(400).json({ error: 'name, date and venue are required.' });
  }

  let slug = slugify(name);
  const collision = await pool.query('SELECT id FROM events WHERE slug = $1', [slug]);
  if (collision.rows.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

  const result = await pool.query(
    `INSERT INTO events (owner_id, slug, name, type, date, start_time, end_time, venue, description, timezone, plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.user.id, slug, name, type || 'Other', date, startTime || null, endTime || null, venue, description || null, timezone || null, plan || 'free']
  );

  res.status(201).json({ event: toPublicEvent(result.rows[0], { guestCount: 0, assignedCount: 0, checkedInCount: 0 }) });
});

const updateEvent = asyncHandler(async (req, res) => {
  const fields = ['name', 'type', 'date', 'start_time', 'end_time', 'venue', 'description', 'timezone', 'logo_url', 'theme', 'status', 'plan', 'show_tablemates', 'anonymous_lookup', 'qr_active'];
  const bodyKeyMap = { startTime: 'start_time', endTime: 'end_time', logo: 'logo_url', showTablemates: 'show_tablemates', anonymousLookup: 'anonymous_lookup', qrActive: 'qr_active' };

  const updates = [];
  const values = [];
  let i = 1;

  for (const [bodyKey, value] of Object.entries(req.body)) {
    const column = bodyKeyMap[bodyKey] || (fields.includes(bodyKey) ? bodyKey : null);
    if (!column) continue;
    updates.push(`${column} = $${i}`);
    values.push(value);
    i += 1;
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  values.push(req.params.id, req.user.id);
  const result = await pool.query(
    `UPDATE events SET ${updates.join(', ')}, updated_at = now()
     WHERE id = $${i} AND owner_id = $${i + 1} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: toPublicEvent(result.rows[0]) });
});

const deleteEvent = asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM events WHERE id = $1 AND owner_id = $2 RETURNING id', [req.params.id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
  res.status(204).send();
});

const publishEvent = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE events SET status = 'live', qr_active = true, updated_at = now()
     WHERE id = $1 AND owner_id = $2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: toPublicEvent(result.rows[0]) });
});

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent, publishEvent, toPublicEvent, slugify };
