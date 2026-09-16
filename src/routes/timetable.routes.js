const router = require('express').Router();
const timetable = require('../controllers/timetable.core.controller');
const timetableImport = require('../controllers/timetable.import.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const timetableUpload = require('../middleware/timetableUpload');

router.get('/', requireAuth, timetable.index);

// Ommaviy Excel import faqat operatsion administratorlar uchun.
router.get('/import', requireRole('superadmin','tech'), timetableImport.importPage);
router.get('/import/template', requireRole('superadmin','tech'), timetableImport.downloadTemplate);
router.post('/import/preview', requireRole('superadmin','tech'), timetableUpload.single('timetableFile'), timetableImport.previewImport);
router.post('/import/confirm', requireRole('superadmin','tech'), timetableImport.confirmImport);
router.post('/import/cancel', requireRole('superadmin','tech'), timetableImport.cancelImport);

router.get('/new', requireRole('superadmin','tech','magistracy','dean','department'), timetable.form);
router.post('/', requireRole('superadmin','tech','magistracy','dean','department'), timetable.create);
router.get('/:id/edit', requireRole('superadmin','tech','magistracy','dean','department'), timetable.form);
router.post('/:id', requireRole('superadmin','tech','magistracy','dean','department'), timetable.update);
router.post('/:id/delete', requireRole('superadmin','tech','magistracy','dean','department'), timetable.remove);

module.exports = router;
