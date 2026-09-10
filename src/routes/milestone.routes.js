const router = require('express').Router();
const c = require('../controllers/milestone.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
router.get('/', requireAuth, c.index);
router.post('/:studentId/:stage', requireRole('superadmin','tech','magistracy','dean','department','supervisor'), c.save);
module.exports = router;
