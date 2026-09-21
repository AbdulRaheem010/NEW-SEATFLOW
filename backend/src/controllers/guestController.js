const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');

function toPublicGuest(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    group: row.group,
    vip: row.vip,
    meal: row.meal,
    tableId: row.table_id,
    tableName: row.table_name || null,
    seatNumber: row.seat_number,
    checkedIn: row.checked_in,
    checkedInAt: row.checked_in_at,
    notes: row.notes,
  };
}

/** Confirms the requesting user owns the event before touching its guests. */
async function assertOwnsEvent(eventId, userId) {
  const result = await pool.query('SELECT id FROM events WHERE id = $1 AND owner_id = $2', [eventId, userId]);
  return result.rows.length > 0;
}

const listGuests = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const result = await pool.query(
    `SELECT g.*, t.name AS table_name FROM guests g
     LEFT JOIN tables t ON t.id = g.table_id
     WHERE g.event_id = $1 ORDER BY g.last_name, g.first_name`,
    [req.params.eventId]
  );
  res.json({ guests: result.rows.map(toPublicGuest) });
});

const createGuest = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const { firstName, lastName, email, phone, group, vip, meal, notes } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'firstName and lastName are required.' });

  const result = await pool.query(
    `INSERT INTO guests (event_id, first_name, last_name, email, phone, "group", vip, meal, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.params.eventId, firstName, lastName, email || null, phone || null, group || null, !!vip, meal || null, notes || null]
  );
  res.status(201).json({ guest: toPublicGuest(result.rows[0]) });
});

/** Bulk import — accepts { guests: [...] } from the CSV/Excel import UI. */
const bulkImportGuests = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const { guests } = req.body;
  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ error: 'guests must be a non-empty array.' });
  }

  const inserted = [];
  const skipped = [];
  for (const g of guests) {
    if (!g.firstName || !g.lastName) { skipped.push(g); continue; }
    const result = await pool.query(
      `INSERT INTO guests (event_id, first_name, last_name, email, phone, "group", vip, meal, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.eventId, g.firstName, g.lastName, g.email || null, g.phone || null, g.group || null, !!g.vip, g.meal || null, g.notes || null]
    );
    inserted.push(toPublicGuest(result.rows[0]));
  }

  res.status(201).json({ imported: inserted.length, skipped: skipped.length, guests: inserted });
});

const updateGuest = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const fields = { firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', group: '"group"', vip: 'vip', meal: 'meal', tableId: 'table_id', seatNumber: 'seat_number', notes: 'notes' };
  const updates = [];
  const values = [];
  let i = 1;
  for (const [bodyKey, value] of Object.entries(req.body)) {
    if (!fields[bodyKey]) continue;
    updates.push(`${fields[bodyKey]} = $${i}`);
    values.push(value);
    i += 1;
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  values.push(req.params.guestId, req.params.eventId);
  const result = await pool.query(
    `UPDATE guests SET ${updates.join(', ')} WHERE id = $${i} AND event_id = $${i + 1} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Guest not found.' });
  res.json({ guest: toPublicGuest(result.rows[0]) });
});

const checkInGuest = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const result = await pool.query(
    `UPDATE guests SET checked_in = true, checked_in_at = now()
     WHERE id = $1 AND event_id = $2 RETURNING *`,
    [req.params.guestId, req.params.eventId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Guest not found.' });
  res.json({ guest: toPublicGuest(result.rows[0]) });
});

const deleteGuest = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const result = await pool.query('DELETE FROM guests WHERE id = $1 AND event_id = $2 RETURNING id', [req.params.guestId, req.params.eventId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Guest not found.' });
  res.status(204).send();
});

/**
 * Public guest lookup — no auth required, reached from the guest-facing
 * event page. Never returns a browsable list: only exact name matches for
 * this one event, and only the fields a guest should see.
 */
const publicGuestLookup = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { name, disambiguator } = req.query;

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Enter a name to search for.' });
  }

  const eventResult = await pool.query('SELECT * FROM events WHERE slug = $1', [slug]);
  const event = eventResult.rows[0];
  if (!event) return res.status(404).json({ error: 'Event not found.' });

  const searchTerm = `%${String(name).trim().toLowerCase()}%`;
  const matchResult = await pool.query(
    `SELECT g.*, t.name AS table_name FROM guests g
     LEFT JOIN tables t ON t.id = g.table_id
     WHERE g.event_id = $1 AND (lower(g.first_name || ' ' || g.last_name) LIKE $2)`,
    [event.id, searchTerm]
  );

  let matches = matchResult.rows;

  if (matches.length > 1 && disambiguator) {
    const d = String(disambiguator).trim().toLowerCase();
    matches = matches.filter((g) => (g.email || '').toLowerCase().includes(d) || (g.group || '').toLowerCase().includes(d));
  }

  if (matches.length === 0) {
    return res.status(404).json({ error: 'No matching guest found. Check the spelling and try again.' });
  }
  if (matches.length > 1) {
    return res.status(300).json({ error: 'Multiple guests matched that name.', needsDisambiguation: true });
  }

  const guest = matches[0];
  const response = {
    firstName: guest.first_name,
    lastName: guest.last_name,
    tableName: guest.table_name,
    seatNumber: guest.seat_number,
  };

  if (event.show_tablemates && guest.table_id) {
    const tablemates = await pool.query(
      `SELECT first_name, last_name FROM guests WHERE table_id = $1 AND id != $2`,
      [guest.table_id, guest.id]
    );
    response.tablemates = tablemates.rows.map((r) => `${r.first_name} ${r.last_name}`);
  }

  res.json({ guest: response });
});

module.exports = { listGuests, createGuest, bulkImportGuests, updateGuest, checkInGuest, deleteGuest, publicGuestLookup };
