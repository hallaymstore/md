const router=require('express').Router();
const c=require('../controllers/control.controller');
const {requireRole}=require('../middleware/auth');
router.get('/',requireRole('superadmin','tech'),c.index);
router.get('/:entity/:id',requireRole('superadmin','tech'),c.editor);
router.post('/:entity/:id',requireRole('superadmin','tech'),c.update);
router.post('/:entity/:id/delete',requireRole('superadmin','tech'),c.remove);
module.exports=router;
