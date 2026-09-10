const router = require('express').Router();
const c = require('../controllers/insights.controller');
const { requireRole } = require('../middleware/auth');
const allowed = requireRole('superadmin','tech','management','magistracy','dean','department','supervisor','teacher');
router.get('/risks', allowed, c.risks);
router.get('/supervisors', allowed, c.supervisors);
module.exports = router;
