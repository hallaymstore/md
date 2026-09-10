const router = require('express').Router();
const controller = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', controller.index);
router.post('/read-all', controller.readAll);
router.post('/:id/read', controller.readOne);

module.exports = router;
