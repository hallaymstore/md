const router = require('express').Router();
const c = require('../controllers/profile.controller');
const avatarUpload = require('../middleware/avatarUpload');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, c.me);
router.get('/edit', requireAuth, c.edit);
router.post('/edit', requireAuth, c.update);
router.post('/avatar', requireAuth, avatarUpload.single('avatar'), c.avatar);
router.post('/avatar/remove', requireAuth, c.removeAvatar);
router.get('/:id', requireAuth, c.show);

module.exports = router;
