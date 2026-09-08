const router = require('express').Router();
const upload = require('../middleware/upload');
const c = require('../controllers/submission.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const viewers = ['superadmin','tech','management','magistracy','dean','department','supervisor','student'];

router.get('/', requireRole(...viewers), c.index);
router.get('/new', requireRole('student'), c.newForm);
router.post('/', requireRole('student'), upload.array('files', 5), c.create);
router.get('/:id', requireRole(...viewers), c.view);
router.post('/:id/comment', requireRole(...viewers), c.comment);
router.post('/:id/decision', requireRole('superadmin','management','magistracy','dean','department','supervisor'), c.decision);
router.post('/:id/resubmit', requireRole('student'), upload.array('files', 5), c.resubmit);
router.post('/:id/admin-edit', requireRole('superadmin'), c.adminEdit);
router.post('/:id/delete', requireRole('superadmin'), c.remove);

module.exports = router;
