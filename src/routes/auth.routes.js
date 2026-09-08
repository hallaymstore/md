const router = require('express').Router();
const c = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
router.get('/login', c.showLogin);
router.post('/login', c.login);
router.post('/logout', requireAuth, c.logout);
router.get('/password', requireAuth, c.showPassword);
router.post('/password', requireAuth, c.changePassword);
module.exports = router;
