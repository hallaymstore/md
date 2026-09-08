const router = require('express').Router();
const c = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middleware/auth');
router.get('/', requireAuth, c.index);
module.exports = router;
