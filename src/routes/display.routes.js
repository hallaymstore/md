const router = require('express').Router();
const controller = require('../controllers/display.controller');

// Public-safe entrance monitor: only aggregate statistics, no personal records.
router.get('/', controller.index);
router.get('/live', controller.live);

module.exports = router;
