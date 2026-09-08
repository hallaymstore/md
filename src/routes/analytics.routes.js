const router=require('express').Router();
const c=require('../controllers/analytics.controller');
const {requireAuth}=require('../middleware/auth');
router.get('/',requireAuth,c.index);
router.get('/export.csv',requireAuth,c.csv);
module.exports=router;
