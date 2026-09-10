const User = require('../models/User');
const Student = require('../models/Student');
const AcademicStructure = require('../models/AcademicStructure');
const ResearchSubmission = require('../models/ResearchSubmission');
const Notification = require('../models/Notification');
const { CAN_CREATE, ROLE_LABELS, PROTECTED_CREDENTIAL_ROLES } = require('../config/roles');
const audit = require('../services/audit');

const clean=v=>String(v||'').trim();
const protectedCredential = target => PROTECTED_CREDENTIAL_ROLES.includes(target.role);

function inOrgScope(req,target){
  if(req.user.role==='dean') return target.faculty===req.user.faculty;
  if(req.user.role==='department') return target.department===req.user.department;
  return true;
}
function canEditProfile(req,target){
  if(req.user.role==='superadmin') return true;
  if(req.user.role==='tech') return true; // metadata only for protected roles; credentials are guarded below.
  if(req.user.role==='magistracy') return ['dean','department','supervisor','teacher','student'].includes(target.role);
  if(req.user.role==='dean') return inOrgScope(req,target)&&['department','supervisor','teacher','student'].includes(target.role);
  if(req.user.role==='department') return inOrgScope(req,target)&&['supervisor','teacher','student'].includes(target.role);
  return false;
}
function canSecurityManage(req,target){
  if(req.user.role==='superadmin') return true;
  if(req.user.role==='tech') return !protectedCredential(target) && target.role!=='superadmin';
  return canEditProfile(req,target);
}
async function loadStructures(req){
  const q={active:true};
  if(req.user.role==='dean') q.faculty=req.user.faculty;
  if(req.user.role==='department'){q.faculty=req.user.faculty;q.department=req.user.department;}
  return AcademicStructure.find(q).sort({faculty:1,department:1,specialty:1,group:1}).lean();
}

exports.list = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'dean') query.faculty = req.user.faculty;
    if (req.user.role === 'department') query.department = req.user.department;
    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 }).lean();
    const rows=users.map(u=>{ const credentialProtected=req.user.role==='tech'&&PROTECTED_CREDENTIAL_ROLES.includes(u.role); return ({
      ...u, login:credentialProtected?'':u.login,
      credentialProtected,
      canEdit:canEditProfile(req,u),canSecurity:canSecurityManage(req,u),canDelete:(req.user.role==='superadmin'||(req.user.role==='tech'&&!PROTECTED_CREDENTIAL_ROLES.includes(u.role)))&&String(u._id)!==String(req.user._id)
    }); });
    res.render('users/list', { title: 'Foydalanuvchilar', users:rows, roleLabels: ROLE_LABELS });
  } catch (e) { next(e); }
};

exports.newWizard = async (req, res, next) => {
  try{
    const structures=await loadStructures(req);
    res.render('users/new', {
      title: 'Hisob yaratish', allowedRoles: CAN_CREATE[req.user.role] || [], roleLabels: ROLE_LABELS, structures
    });
  }catch(e){next(e);}
};

exports.create = async (req, res, next) => {
  try {
    const allowed = CAN_CREATE[req.user.role] || [];
    if (!allowed.includes(req.body.role)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    if (req.user.role === 'dean') req.body.faculty = req.user.faculty;
    if (req.user.role === 'department') { req.body.faculty = req.user.faculty; req.body.department = req.user.department; }
    const login = clean(req.body.login).toLowerCase();
    if (!login || !req.body.password || String(req.body.password).length < 8) {
      req.session.flash = { type: 'error', text: 'Login va kamida 8 belgili vaqtinchalik parol kiriting.' }; return res.redirect('/users/new');
    }
    if (await User.exists({ login })) { req.session.flash = { type: 'error', text: 'Bu login band.' }; return res.redirect('/users/new'); }
    const user = new User({
      login,passwordHash:'pending',role:req.body.role,fullName:clean(req.body.fullName),employeeId:clean(req.body.employeeId),
      faculty:clean(req.body.faculty),department:clean(req.body.department),phone:clean(req.body.phone),email:clean(req.body.email),
      active:true,mustChangePassword:true,createdBy:req.user._id
    });
    await user.setPassword(req.body.password); await user.save();
    await audit(req, 'USER_CREATED', 'User', user._id, { role: user.role, login: user.login });
    req.session.flash = { type: 'success', text: `Hisob yaratildi: ${user.login}` }; res.redirect('/users');
  } catch (e) { next(e); }
};

exports.editForm=async(req,res,next)=>{
  try{
    const target=await User.findById(req.params.id).select('-passwordHash').lean();
    if(!target||!canEditProfile(req,target)) return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const structures=await loadStructures(req);
    if(req.user.role==='tech'&&protectedCredential(target)) target.login=undefined;
    res.render('users/edit',{title:`${target.fullName} — tahrirlash`,target,structures,roleLabels:ROLE_LABELS,credentialProtected:req.user.role==='tech'&&protectedCredential(target),canSecurity:canSecurityManage(req,target)});
  }catch(e){next(e);}
};

exports.update=async(req,res,next)=>{
  try{
    const target=await User.findById(req.params.id); if(!target||!canEditProfile(req,target))return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const old={fullName:target.fullName,faculty:target.faculty,department:target.department,phone:target.phone,email:target.email};
    ['fullName','employeeId','faculty','department','phone','email'].forEach(k=>{if(req.body[k]!==undefined)target[k]=clean(req.body[k]);});
    if(req.user.role==='dean')target.faculty=req.user.faculty;
    if(req.user.role==='department'){target.faculty=req.user.faculty;target.department=req.user.department;}
    // Login and role are credential/governance fields. Tech never changes them for protected roles.
    if(req.user.role==='superadmin'){
      if(req.body.login){const login=clean(req.body.login).toLowerCase();if(login!==target.login&&await User.exists({login,_id:{$ne:target._id}})){req.session.flash={type:'error',text:'Bu login band.'};return res.redirect(`/users/${target._id}/edit`);}target.login=login;}
      if(req.body.role&&ROLE_LABELS[req.body.role])target.role=req.body.role;
    }
    await target.save();
    // keep linked student contact/organization synchronized where helpful
    await Student.updateMany({user:target._id},{$set:{fullName:target.fullName,faculty:target.faculty,department:target.department,phone:target.phone,email:target.email}});
    await audit(req,'USER_PROFILE_UPDATED','User',target._id,{old,next:{fullName:target.fullName,faculty:target.faculty,department:target.department}});
    req.session.flash={type:'success',text:protectedCredential(target)&&req.user.role==='tech'?'Profil yangilandi. Himoyalangan login/parol o‘zgarmadi.':'Foydalanuvchi ma’lumotlari yangilandi.'};
    res.redirect('/users');
  }catch(e){next(e);}
};

exports.toggle = async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target || !canSecurityManage(req, target)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    if(String(target._id)===String(req.user._id)){req.session.flash={type:'warning',text:'O‘z hisobingizni bloklay olmaysiz.'};return res.redirect('/users');}
    if(target.active&&['supervisor','teacher'].includes(target.role)){
      const activeReviews=await ResearchSubmission.countDocuments({supervisor:target._id,status:{$in:['draft','under_review','changes_requested']}});
      if(activeReviews){req.session.flash={type:'warning',text:`Hisobni bloklashdan oldin ${activeReviews} ta faol arizada ilmiy rahbarni almashtiring.`};return res.redirect('/users');}
    }
    target.active = !target.active; await target.save();
    await audit(req, target.active ? 'USER_ENABLED' : 'USER_DISABLED', 'User', target._id); res.redirect('/users');
  } catch (e) { next(e); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target || !canSecurityManage(req, target)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    const password = String(req.body.password || '');
    if (password.length < 8) { req.session.flash = { type: 'error', text: 'Parol kamida 8 belgi bo‘lishi kerak.' }; return res.redirect('/users'); }
    await target.setPassword(password); target.mustChangePassword = true; await target.save();
    await audit(req, 'PASSWORD_RESET', 'User', target._id); req.session.flash = { type: 'success', text: 'Vaqtinchalik parol yangilandi.' }; res.redirect('/users');
  } catch (e) { next(e); }
};

exports.remove=async(req,res,next)=>{
  try{
    if(!['superadmin','tech'].includes(req.user.role))return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const target=await User.findById(req.params.id); if(!target)return res.redirect('/users');
    if(String(target._id)===String(req.user._id)||target.role==='superadmin'||(req.user.role==='tech'&&PROTECTED_CREDENTIAL_ROLES.includes(target.role))){req.session.flash={type:'warning',text:'Bu himoyalangan hisobni texnik paneldan o‘chirib bo‘lmaydi.'};return res.redirect('/users');}
    const linked=await Student.countDocuments({user:target._id});
    if(linked){req.session.flash={type:'warning',text:`Bu hisob ${linked} ta magistrant profiliga bog‘langan. Avval bog‘lanishni o‘zgartiring.`};return res.redirect('/users');}
    const activeReviews=await ResearchSubmission.countDocuments({supervisor:target._id,status:{$in:['draft','under_review','changes_requested']}});
    if(activeReviews){req.session.flash={type:'warning',text:`Bu foydalanuvchiga ${activeReviews} ta faol ilmiy ariza bog‘langan. Avval arizalarda ilmiy rahbarni almashtiring.`};return res.redirect('/users');}
    await Notification.deleteMany({recipient:target._id}); await target.deleteOne(); await audit(req,'USER_DELETED','User',req.params.id,{role:target.role,login:req.user.role==='tech'?'[protected-by-policy]':target.login});
    req.session.flash={type:'success',text:'Foydalanuvchi hisobi o‘chirildi.'};res.redirect('/users');
  }catch(e){next(e);}
};
