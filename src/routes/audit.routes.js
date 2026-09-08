const router = require('express').Router();
const c = require('../controllers/audit.controller');
const { requireRole } = require('../middleware/auth');
router.get('/', requireRole('superadmin','tech'), c.index);
module.exports = router;
