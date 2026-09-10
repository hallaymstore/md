const router = require('express').Router();
const c = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middleware/auth');
router.get('/', requireAuth, c.index);
router.get('/live', requireAuth, c.live);
router.get('/groups/:group', requireAuth, c.group);
module.exports = router;
