const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Student = require('../models/Student');
const ScientificActivity = require('../models/ScientificActivity');
const ResearchSubmission = require('../models/ResearchSubmission');
const Seminar = require('../models/Seminar');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');
const Upload = require('../models/Upload');
const { ROLE_LABELS } = require('../config/roles');
const { SUBMISSION_TYPES } = require('../config/submissionWorkflow');
const audit = require('../services/audit');

const clean = (v, max = 500) => String(v || '').trim().slice(0, max);
const ADMIN_ROLES = ['superadmin','tech','magistracy'];

function sameOrg(viewer, target) {
  if (!viewer || !target) return false;
  if (viewer.department && target.department && viewer.department === target.department) return true;
  if (viewer.faculty && target.faculty && viewer.faculty === target.faculty) return true;
  return false;
}

function accessFor(viewer, target, student) {
  const self = String(viewer._id) === String(target._id);
  const admin = ADMIN_ROLES.includes(viewer.role);
  const dean = viewer.role === 'dean' && viewer.faculty && viewer.faculty === target.faculty;
  const department = viewer.role === 'department' && viewer.department && viewer.department === target.department;
  const management = viewer.role === 'management';
  const assignedSupervisor = !!student && viewer.role === 'supervisor' && String(student.supervisor?._id || student.supervisor || '') === String(viewer._id);
  const teacherAcademic = !!student && viewer.role === 'teacher' && viewer.department && viewer.department === student.department;
  const contact = self || admin || dean || department || assignedSupervisor;
  const academic = self || admin || dean || department || management || assignedSupervisor || teacherAcademic;
  return { self, admin, contact, academic, sameOrg: sameOrg(viewer, target) };
}

async function buildPortfolio(studentId) {
  if (!studentId) return { items: [], stats: { total:0, publications:0, conferences:0, approved:0 } };
  const [science, approved] = await Promise.all([
    ScientificActivity.find({ student: studentId, status: { $in:['accepted','published','completed'] } })
      .select('type title organization date status link createdAt').sort({ date:-1, createdAt:-1 }).limit(30).lean(),
    ResearchSubmission.find({ student: studentId, status:'approved' })
      .select('type title applicationNo completedAt updatedAt createdAt').sort({ completedAt:-1, updatedAt:-1 }).limit(30).lean()
  ]);
  const items = [
    ...science.map(x => ({
      type: x.type, typeLabel: ({publication:'Ilmiy maqola',conference:'Konferensiya',research:'Tadqiqot',seminar:'Ilmiy seminar'})[x.type] || 'Ilmiy ish',
      title:x.title, organization:x.organization || '', date:x.date || x.createdAt, url:/^https?:\/\//i.test(x.link || '') ? x.link : ''
    })),
    ...approved.map(x => ({
      type:x.type, typeLabel:SUBMISSION_TYPES[x.type] || 'Tasdiqlangan ish', title:x.title,
      organization:x.applicationNo ? `MD • ${x.applicationNo}` : 'MD ichki tasdiqlash', date:x.completedAt || x.updatedAt || x.createdAt, url:''
    }))
  ].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
  return {
    items,
    stats: {
      total: items.length,
      publications: science.filter(x => x.type === 'publication').length,
      conferences: science.filter(x => x.type === 'conference').length,
      approved: approved.length
    }
  };
}

const uniqCount = async (filter, field) => (await Student.distinct(field, { ...filter, [field]: { $nin:[null,''] } })).length;
const average = (rows, field) => rows.length ? Math.round(rows.reduce((n,x)=>n+Number(x[field]||0),0)/rows.length) : 0;
const stat = (label, value, opts={}) => ({ label, value, ...opts });

async function buildRoleProfile(target) {
  const baseDetails = [
    ['Rol', ROLE_LABELS[target.role] || target.role],
    ['Lavozim', target.position || ROLE_LABELS[target.role] || '—'],
    ['Ilmiy daraja', target.academicDegree || '—'],
    ['Ilmiy unvon', target.academicTitle || '—'],
    ['Fakultet', target.faculty || '—'],
    ['Kafedra / bo‘lim', target.department || '—'],
    ['Xona / ofis', target.office || '—']
  ];
  let stats = [], details = baseDetails, related = [], subtitle = 'Ichki professional profil';

  if (target.role === 'superadmin') {
    const [users, activeUsers, students, todayAudit] = await Promise.all([
      User.countDocuments(), User.countDocuments({active:true}), Student.countDocuments({studyStatus:'active'}),
      AuditLog.countDocuments({createdAt:{$gte:new Date(new Date().setHours(0,0,0,0))}})
    ]);
    stats = [stat('Foydalanuvchilar',users,{href:'/users'}),stat('Faol hisob',activeUsers,{href:'/users'}),stat('Magistrantlar',students,{href:'/students'}),stat('Bugungi audit',todayAudit,{href:'/audit'})];
    subtitle = 'Tizim boshqaruvi va global nazorat';
    related = await User.find({_id:{$ne:target._id},active:true,role:{$in:['tech','management','magistracy']}}).select('fullName role avatarPath faculty department').limit(8).lean();
  } else if (target.role === 'tech') {
    const [activeUsers, uploads, openTasks, todayAudit] = await Promise.all([
      User.countDocuments({active:true}), Upload.countDocuments(), Task.countDocuments({status:{$in:['new','in_progress']}}),
      AuditLog.countDocuments({createdAt:{$gte:new Date(new Date().setHours(0,0,0,0))}})
    ]);
    stats = [stat('Faol hisob',activeUsers,{href:'/users'}),stat('Fayllar',uploads,{href:'/uploads'}),stat('Ochiq topshiriq',openTasks,{href:'/tasks'}),stat('Bugungi audit',todayAudit,{href:'/audit'})];
    subtitle = 'Texnik ekspluatatsiya va tizim salomatligi';
  } else if (target.role === 'management') {
    const [students, risky, rows, pending] = await Promise.all([
      Student.countDocuments({studyStatus:'active'}), Student.countDocuments({studyStatus:'active',status:'red'}),
      Student.find({studyStatus:'active'}).select('graduationReadiness').lean(),
      ResearchSubmission.countDocuments({status:'under_review',currentStage:'management'})
    ]);
    stats = [stat('Magistrantlar',students,{href:'/students'}),stat('Riskdagi',risky,{href:'/insights/risks'}),stat('Bitiruv tayyorligi',average(rows,'graduationReadiness'),{suffix:'%',ring:true,href:'/analytics'}),stat('Yakuniy ariza',pending,{href:'/submissions'})];
    subtitle = 'Rahbariyat • umumiy monitoring';
    related = await User.find({active:true,role:{$in:['magistracy','dean']}}).select('fullName role avatarPath faculty department').limit(10).lean();
  } else if (target.role === 'magistracy') {
    const [students, groups, supervisors, pending] = await Promise.all([
      Student.countDocuments({studyStatus:'active'}), uniqCount({studyStatus:'active'},'group'), User.countDocuments({active:true,role:'supervisor'}),
      ResearchSubmission.countDocuments({status:'under_review',currentStage:'magistracy'})
    ]);
    stats = [stat('Magistrantlar',students,{href:'/students'}),stat('Guruhlar',groups,{href:'/students'}),stat('Ilmiy rahbarlar',supervisors,{href:'/insights/supervisors'}),stat('Ko‘rib chiqish',pending,{href:'/submissions'})];
    subtitle = 'Magistratura bo‘limi • kontingent va ilmiy jarayon';
    related = await User.find({active:true,role:{$in:['dean','department','supervisor']}}).select('fullName role avatarPath faculty department').limit(10).lean();
  } else if (target.role === 'dean') {
    const filter = {studyStatus:'active',faculty:target.faculty};
    const [students, departments, groups, risky] = await Promise.all([
      Student.countDocuments(filter), uniqCount(filter,'department'), uniqCount(filter,'group'), Student.countDocuments({...filter,status:'red'})
    ]);
    stats = [stat('Fakultet magistranti',students,{href:'/students'}),stat('Kafedralar',departments,{href:'/analytics'}),stat('Guruhlar',groups,{href:'/students'}),stat('Riskdagi',risky,{href:'/insights/risks'})];
    subtitle = `${target.faculty || 'Fakultet'} • dekanat monitoringi`;
    related = await User.find({active:true,faculty:target.faculty,role:{$in:['department','supervisor','teacher']}}).select('fullName role avatarPath faculty department').limit(10).lean();
  } else if (target.role === 'department') {
    const filter = {studyStatus:'active',department:target.department};
    const [students, supervisors, teachers, groups] = await Promise.all([
      Student.countDocuments(filter), User.countDocuments({active:true,department:target.department,role:'supervisor'}),
      User.countDocuments({active:true,department:target.department,role:'teacher'}), uniqCount(filter,'group')
    ]);
    stats = [stat('Magistrantlar',students,{href:'/students'}),stat('Ilmiy rahbarlar',supervisors,{href:'/insights/supervisors'}),stat('O‘qituvchilar',teachers,{href:'/users'}),stat('Guruhlar',groups,{href:'/students'})];
    subtitle = `${target.department || 'Kafedra'} • akademik va ilmiy boshqaruv`;
    related = await User.find({active:true,department:target.department,role:{$in:['supervisor','teacher']}}).select('fullName role avatarPath faculty department').limit(10).lean();
  } else if (target.role === 'supervisor') {
    const rows = await Student.find({studyStatus:'active',supervisor:target._id}).select('user fullName group status dissertationProgress graduationReadiness').populate('user','fullName role avatarPath faculty department').lean();
    const pending = await ResearchSubmission.countDocuments({supervisor:target._id,status:{$in:['draft','under_review','changes_requested']}});
    stats = [stat('Biriktirilgan',rows.length,{href:'/students'}),stat('Riskdagi',rows.filter(x=>x.status==='red').length,{href:'/insights/risks'}),stat('Dissertatsiya',average(rows,'dissertationProgress'),{suffix:'%',ring:true,href:'/milestones'}),stat('Faol ariza',pending,{href:'/submissions'})];
    subtitle = 'Ilmiy rahbar • magistrantlar va dissertatsiya nazorati';
    related = rows.filter(x=>x.user).slice(0,10).map(x=>x.user);
  } else if (target.role === 'teacher') {
    const filter = target.department ? {studyStatus:'active',department:target.department} : {studyStatus:'active',faculty:target.faculty};
    const [students, groups, seminars, tasks] = await Promise.all([
      Student.countDocuments(filter), uniqCount(filter,'group'), Seminar.countDocuments({responsible:target._id}), Task.countDocuments({assignedTo:target._id,status:{$in:['new','in_progress']}})
    ]);
    stats = [stat('Magistrantlar',students,{href:'/students'}),stat('Guruhlar',groups,{href:'/students'}),stat('Seminarlar',seminars,{href:'/seminars'}),stat('Topshiriqlar',tasks,{href:'/tasks'})];
    subtitle = 'O‘qituvchi • akademik jarayon va seminarlar';
    related = await User.find({active:true,department:target.department,_id:{$ne:target._id},role:{$in:['department','supervisor','teacher']}}).select('fullName role avatarPath faculty department').limit(8).lean();
  }

  return { stats, details, related, subtitle };
}

exports.me = (req, res) => res.redirect(`/profile/${req.user._id}`);

exports.show = async (req, res, next) => {
  try {
    const target = await User.findOne({ _id:req.params.id, active:true }).select('-passwordHash').lean();
    if (!target) return res.status(404).render('errors/404', { title:'Profil topilmadi' });
    const student = target.role === 'student'
      ? await Student.findOne({ user:target._id }).populate('supervisor','fullName avatarPath role').lean()
      : null;
    const access = accessFor(req.user, target, student);
    const portfolio = student ? await buildPortfolio(student._id) : { items:[], stats:{ total:0, publications:0, conferences:0, approved:0 } };
    const supervisedCount = ['supervisor','teacher'].includes(target.role)
      ? await Student.countDocuments({ supervisor:target._id, studyStatus:'active' }) : 0;
    const roleProfile = target.role === 'student' ? null : await buildRoleProfile(target);
    const roleMismatch = target.role === 'student' && !student;
    res.render('profile/show', {
      title:`${target.fullName} — profil`, target, student, access, portfolio, supervisedCount, roleProfile,
      roleMismatch, canCorrectRole:req.user.role==='superadmin', roleLabels:ROLE_LABELS
    });
  } catch (e) { next(e); }
};

exports.edit = async (req, res, next) => {
  try {
    const target = await User.findById(req.user._id).select('-passwordHash').lean();
    const student = req.user.role === 'student' ? await Student.findOne({ user:req.user._id }).lean() : null;
    res.render('profile/edit', { title:'Mening profilim', target, student, roleLabels:ROLE_LABELS });
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.redirect('/login');
    user.phone = clean(req.body.phone, 50);
    user.email = clean(req.body.email, 180).toLowerCase();
    user.bio = clean(req.body.bio, 320);
    user.position = clean(req.body.position, 140);
    user.academicDegree = clean(req.body.academicDegree, 120);
    user.academicTitle = clean(req.body.academicTitle, 120);
    user.office = clean(req.body.office, 120);
    await user.save();
    if (user.role === 'student') {
      await Student.updateOne({ user:user._id }, { $set:{ phone:user.phone, email:user.email, profileUpdatedAt:new Date() } });
    }
    await audit(req, 'SELF_PROFILE_UPDATED', 'User', user._id, { fields:['phone','email','bio','position','academicDegree','academicTitle','office'] });
    req.session.flash = { type:'success', text:'Profil ma’lumotlari yangilandi.' };
    res.redirect('/profile/edit');
  } catch (e) { next(e); }
};

function removeLocalAvatar(avatarPath) {
  if (!avatarPath || !avatarPath.startsWith('/static/uploads/avatars/')) return;
  const file = path.join(__dirname, '../../public/uploads/avatars', path.basename(avatarPath));
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
}

exports.avatar = async (req, res, next) => {
  try {
    if (!req.file) {
      req.session.flash = { type:'warning', text:'Rasm tanlanmadi.' };
      return res.redirect('/profile/edit');
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.redirect('/login');
    removeLocalAvatar(user.avatarPath);
    user.avatarPath = `/static/uploads/avatars/${req.file.filename}`;
    await user.save();
    await audit(req, 'PROFILE_AVATAR_UPDATED', 'User', user._id);
    req.session.flash = { type:'success', text:'Profil rasmi yangilandi.' };
    res.redirect('/profile/edit');
  } catch (e) { next(e); }
};

exports.removeAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.redirect('/login');
    removeLocalAvatar(user.avatarPath);
    user.avatarPath = '';
    await user.save();
    await audit(req, 'PROFILE_AVATAR_REMOVED', 'User', user._id);
    req.session.flash = { type:'success', text:'Profil rasmi olib tashlandi. Rol uchun standart ikon ishlatiladi.' };
    res.redirect('/profile/edit');
  } catch (e) { next(e); }
};
