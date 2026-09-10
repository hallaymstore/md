const router = require('express').Router();
const c = require('../controllers/upload.controller');
const { requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const viewers=['superadmin','tech','magistracy','dean','department','supervisor','teacher','student'];
router.get('/', requireRole(...viewers), c.index);
router.post('/', requireRole(...viewers), upload.single('file'), c.upload);
module.exports = router;
