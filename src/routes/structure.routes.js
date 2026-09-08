const router = require('express').Router();
const c = require('../controllers/structure.controller');
const { requireRole } = require('../middleware/auth');

// Tech can read the canonical catalogue, but only superadmin changes university names.
router.get('/', requireRole('superadmin','tech','magistracy'), c.index);
router.post('/', requireRole('superadmin'), c.create);
router.post('/unit', requireRole('superadmin'), c.createUnit);
router.post('/unit/:id/edit', requireRole('superadmin'), c.updateUnit);
router.post('/unit/:id/toggle', requireRole('superadmin'), c.toggleUnit);
router.post('/unit/:id/delete', requireRole('superadmin'), c.removeUnit);
router.post('/rename', requireRole('superadmin'), c.rename);
router.post('/sync', requireRole('superadmin'), c.syncFromStudents);
router.post('/:id/edit', requireRole('superadmin'), c.update);
router.post('/:id/toggle', requireRole('superadmin'), c.toggle);
router.post('/:id/delete', requireRole('superadmin'), c.remove);

module.exports = router;
