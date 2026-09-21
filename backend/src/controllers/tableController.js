const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');

function toPublicTable(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    capacity: row.capacity,
    shape: row.shape,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    locked: row.locked,
    color: row.color,
  };
}

async function assertOwnsEvent(eventId, userId) {
  const result = await pool.query('SELECT id FROM events WHERE id = $1 AND owner_id = $2', [eventId, userId]);
  return result.rows.length > 0;
}

const listTables = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const result = await pool.query('SELECT * FROM tables WHERE event_id = $1 ORDER BY created_at ASC', [req.params.eventId]);
  res.json({ tables: result.rows.map(toPublicTable) });
});

const createTable = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const { name, capacity, shape, x, y, width, height, rotation, color } = req.body;
  const normalizedCapacity = Number(capacity ?? 8);
  if (!Number.isInteger(normalizedCapacity) || normalizedCapacity < 1 || normalizedCapacity > 1000) {
    return res.status(400).json({ error: 'Table capacity must be a whole number between 1 and 1000.' });
  }
  const allowedShapes = ['round', 'square', 'rectangle'];
  if (shape && !allowedShapes.includes(shape)) {
    return res.status(400).json({ error: 'Invalid table shape.' });
  }
  const result = await pool.query(
    `INSERT INTO tables (event_id, name, capacity, shape, x, y, width, height, rotation, color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.params.eventId, name || 'New Table', normalizedCapacity, shape || 'round', x || 0, y || 0, width || 120, height || 120, rotation || 0, color || null]
  );
  res.status(201).json({ table: toPublicTable(result.rows[0]) });
});

const updateTable = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const fields = ['name', 'capacity', 'shape', 'x', 'y', 'width', 'height', 'rotation', 'locked', 'color'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const [key, value] of Object.entries(req.body)) {
    if (!fields.includes(key)) continue;
    updates.push(`${key} = $${i}`);
    values.push(value);
    i += 1;
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

  if (Object.prototype.hasOwnProperty.call(req.body, 'capacity')) {
    const normalizedCapacity = Number(req.body.capacity);
    if (!Number.isInteger(normalizedCapacity) || normalizedCapacity < 1 || normalizedCapacity > 1000) {
      return res.status(400).json({ error: 'Table capacity must be a whole number between 1 and 1000.' });
    }
    const occupied = await pool.query(
      'SELECT COUNT(*)::int AS count FROM guests WHERE event_id = $1 AND table_id = $2',
      [req.params.eventId, req.params.tableId]
    );
    if (normalizedCapacity < occupied.rows[0].count) {
      return res.status(409).json({ error: 'Capacity cannot be lower than the number of guests already seated.' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'shape') && !['round', 'square', 'rectangle'].includes(req.body.shape)) {
    return res.status(400).json({ error: 'Invalid table shape.' });
  }

  values.push(req.params.tableId, req.params.eventId);
  const result = await pool.query(
    `UPDATE tables SET ${updates.join(', ')} WHERE id = $${i} AND event_id = $${i + 1} RETURNING *`,
    values
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Table not found.' });
  res.json({ table: toPublicTable(result.rows[0]) });
});

const deleteTable = asyncHandler(async (req, res) => {
  if (!(await assertOwnsEvent(req.params.eventId, req.user.id))) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  const result = await pool.query('DELETE FROM tables WHERE id = $1 AND event_id = $2 RETURNING id', [req.params.tableId, req.params.eventId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Table not found.' });
  res.status(204).send();
});

module.exports = { listTables, createTable, updateTable, deleteTable };
