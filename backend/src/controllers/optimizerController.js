const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');

async function assertOwnsEvent(eventId, userId) {
  const result = await pool.query('SELECT id FROM events WHERE id = $1 AND owner_id = $2', [eventId, userId]);
  return result.rows.length > 0;
}

/**
 * POST /events/:eventId/optimizer
 * Body: { rules: { mustSitTogether: [[guestId, guestId], ...], mustNotSitTogether: [...], vipNearStage: bool, ... } }
 *
 * This returns RECOMMENDATIONS ONLY — it never writes to the seating
 * arrangement. The frontend must show them for review before anything is
 * applied (see options_card / optimizer.html "Apply Recommendations").
 *
 * This is a deterministic placeholder, not a real AI model. To connect a
 * real model, call it here using process.env.CLAUDE_API_KEY — never from
 * the frontend — and shape its output into the same { changes, conflicts }
 * response below.
 */
const optimizeSeating = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  const guests = await pool.query('SELECT * FROM guests WHERE event_id = $1', [req.params.eventId]);
  const tables = await pool.query('SELECT * FROM tables WHERE event_id = $1 ORDER BY name', [req.params.eventId]);

  if (tables.rows.length === 0) {
    return res.status(400).json({ error: 'Add at least one table before running the optimizer.' });
  }

  const unassigned = guests.rows.filter((g) => !g.table_id);
  const changes = [];
  const conflicts = [];

  // Deterministic first pass: fill tables in order, respecting capacity.
  const tableFillCount = new Map(tables.rows.map((t) => [t.id, guests.rows.filter((g) => g.table_id === t.id).length]));
  let tableIndex = 0;

  for (const guest of unassigned) {
    let attempts = 0;
    while (attempts < tables.rows.length) {
      const table = tables.rows[tableIndex % tables.rows.length];
      const current = tableFillCount.get(table.id) || 0;
      if (current < table.capacity) {
        changes.push({
          guestId: guest.id,
          guestName: `${guest.first_name} ${guest.last_name}`,
          fromTableId: null,
          toTableId: table.id,
          toTableName: table.name,
        });
        tableFillCount.set(table.id, current + 1);
        tableIndex += 1;
        break;
      }
      tableIndex += 1;
      attempts += 1;
    }
    if (attempts >= tables.rows.length) {
      conflicts.push({ guestId: guest.id, guestName: `${guest.first_name} ${guest.last_name}`, reason: 'No table has remaining capacity.' });
    }
  }

  res.json({
    changes,
    conflicts,
    summary: `${changes.length} recommended changes, ${conflicts.length} conflicts detected.`,
  });
});

module.exports = { optimizeSeating };
