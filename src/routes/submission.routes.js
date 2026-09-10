const router = require('express').Router();
const controller = require('../controllers/submission.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/submissionUpload');

router.use(requireAuth);
router.get('/', controller.index);
router.get('/export.csv', controller.exportCsv);
router.get('/new', requireRole('student'), controller.newForm);
router.post('/', requireRole('student'), upload.array('files', Number(process.env.SUBMISSION_MAX_FILES || 5)), controller.create);
router.get('/:id/files/:uploadId', controller.download);
router.post('/:id/files/:uploadId/delete', requireRole('student'), controller.removeAttachment);
router.post('/:id/save', requireRole('student'), upload.array('files', Number(process.env.SUBMISSION_MAX_FILES || 5)), controller.save);
router.post('/:id/submit', requireRole('student'), controller.submit);
router.post('/:id/decision', requireRole('superadmin', 'supervisor', 'teacher', 'department', 'dean', 'magistracy', 'management'), controller.decision);
router.post('/:id/comment', controller.comment);
router.post('/:id/withdraw', requireRole('student'), controller.withdraw);
router.post('/:id/admin', requireRole('superadmin'), controller.adminAction);
router.get('/:id', controller.view);

module.exports = router;
