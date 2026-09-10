const router=require('express').Router();
const multer=require('multer');
const c=require('../controllers/hemis.controller');
const {requireRole}=require('../middleware/auth');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,/csv|text|excel/i.test(file.mimetype||'')||/\.csv$/i.test(file.originalname))});
router.use(requireRole('superadmin','tech','magistracy'));
router.get('/',c.index);
router.post('/upload',upload.single('csv'),c.upload);
module.exports=router;
