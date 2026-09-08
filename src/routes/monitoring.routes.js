const router = require('express').Router();
const c = require('../controllers/monitoring.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
router.get('/', requireAuth, c.index);
router.post('/items', requireRole('superadmin','tech','magistracy','dean','department','supervisor','teacher'), c.createItem);
module.exports = router;
