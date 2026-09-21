const express = require('express');
const { requireAuth } = require('../middleware/auth');
const events = require('../controllers/eventController');
const tables = require('../controllers/tableController');
const guests = require('../controllers/guestController');
const { optimizeSeating } = require('../controllers/optimizerController');

const router = express.Router();
router.use(requireAuth);

router.get('/', events.listEvents);
router.post('/', events.createEvent);
router.get('/:id', events.getEvent);
router.patch('/:id', events.updateEvent);
router.delete('/:id', events.deleteEvent);
router.post('/:id/publish', events.publishEvent);

router.get('/:eventId/tables', tables.listTables);
router.post('/:eventId/tables', tables.createTable);
router.patch('/:eventId/tables/:tableId', tables.updateTable);
router.delete('/:eventId/tables/:tableId', tables.deleteTable);

router.get('/:eventId/guests', guests.listGuests);
router.post('/:eventId/guests', guests.createGuest);
router.post('/:eventId/guests/import', guests.bulkImportGuests);
router.patch('/:eventId/guests/:guestId', guests.updateGuest);
router.post('/:eventId/guests/:guestId/check-in', guests.checkInGuest);
router.delete('/:eventId/guests/:guestId', guests.deleteGuest);

router.post('/:eventId/optimizer', optimizeSeating);

module.exports = router;
