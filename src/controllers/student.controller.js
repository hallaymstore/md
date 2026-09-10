const Student = require('../models/Student');
const User = require('../models/User');
const AcademicStructure = require('../models/AcademicStructure');
const ScientificActivity = require('../models/ScientificActivity');
const ResearchSubmission = require('../models/ResearchSubmission');
const { scopeQueryForUser } = require('../middleware/auth');
const { SUBMISSION_TYPES } = require('../config/submissionWorkflow');
const audit = require('../services/audit');
const stages = require('../utils/dissertationStages');

const ENTRY_ROLES = ['superadmin','tech','magistracy','dean','department'];
const clean = v => String(v || '').trim();
const num = (v, fallback = 0) => (v === '' || v === undefined || v === null ? fallback : Number(v));
const rx = v => new RegExp(String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const SCIENCE_TYPE_LABELS = { publication:'Ilmiy maqola', conference:'Konferensiya', research:'Tadqiqot', seminar:'Ilmiy seminar' };
const SCIENCE_STATUS_LABELS = { accepted:'Qabul qilingan', published:'Chop etilgan', completed:'Yakunlangan' };
const safeHttpUrl = value => /^https?:\/\//i.test(String(value || '').trim()) ? String(value).trim() : '';

function structureScope(user, query = { active: true }) {
  if (user.role === 'dean' && user.faculty) return { ...query, faculty: user.faculty };
  if (user.role === 'department' && user.department) return { ...query, faculty: user.faculty, department: user.department };
  return query;
}

async function loadEntryData(req) {
  const supervisorQuery = { role: { $in: ['supervisor','teacher'] }, active: true };
  if (req.user.role === 'dean') supervisorQuery.faculty = req.user.faculty;
  if (req.user.role === 'department') supervisorQuery.department = req.user.department;
  let [supervisors, linked, structures] = await Promise.all([
    User.find(supervisorQuery).select('fullName faculty department').sort({ fullName: 1 }).lean(),
    Student.find({ user: { $ne: null } }).distinct('user'),
    AcademicStructure.find(structureScope(req.user)).populate('defaultSupervisor','fullName').sort({faculty:1,department:1,specialty:1,group:1}).lean()
  ]);
  // Upgrade-friendly fallback: v2.1 bazasida katalog bo‘lmasa, mavjud talabalardan virtual select variantlarini yig‘amiz.
  if (!structures.length) {
    const studentScope = scopeQueryForUser(req.user, {});
    const rows = await Student.find(studentScope).select('faculty department specialty group course admissionYear educationForm supervisor').lean();
    const map = new Map();
    for (const r of rows) {
      if (!r.faculty || !r.department || !r.specialty || !r.group) continue;
      const key = [r.faculty,r.department,r.specialty,r.group].join('||');
      if (!map.has(key)) map.set(key, { _id:key, faculty:r.faculty, department:r.department, specialty:r.specialty, group:r.group, course:r.course||1, admissionYear:r.admissionYear, educationForm:r.educationForm||'Magistratura', defaultSupervisor:r.supervisor||null, active:true });
    }
    structures = [...map.values()];
  }
  const studentAccounts = await User.find({ role: 'student', active: true, _id: { $nin: linked } })
    .select('fullName login faculty department phone email employeeId').sort({fullName:1}).lean();
  return { supervisors, studentAccounts, structures };
}

function applyScopeToBody(req, body) {
  if (req.user.role === 'dean') body.faculty = req.user.faculty;
  if (req.user.role === 'department') {
    body.faculty = req.user.faculty;
    body.department = req.user.department;
  }
}


function profileAccessFor(user, student) {
  const linkedUserId = student.user?._id || student.user || '';
  const self = user.role === 'student' && String(linkedUserId) === String(user._id);
  const full = self || ['superadmin','tech','magistracy','dean','department'].includes(user.role);
  const limited = full || user.role === 'supervisor';
  const academic = limited || user.role === 'teacher';
  return { self, full, limited, academic };
}

function buildStudentPayload(body, req, defaults = {}) {
  const src = { ...defaults, ...body };
  applyScopeToBody(req, src);
  return {
    user: src.user || undefined,
    fullName: clean(src.fullName),
    studentId: clean(src.studentId) || undefined,
    faculty: clean(src.faculty),
    department: clean(src.department),
    specialty: clean(src.specialty),
    educationForm: clean(src.educationForm) || 'Magistratura',
    admissionYear: src.admissionYear ? num(src.admissionYear) : undefined,
    studyStatus: src.studyStatus || 'active',
    course: num(src.course, 1),
    group: clean(src.group),
    supervisor: src.supervisor || undefined,
    dissertationTitle: clean(src.dissertationTitle),
    phone: clean(src.phone),
    email: clean(src.email),
    telegram: clean(src.telegram),
    academicScore: num(src.academicScore, 0),
    attendance: num(src.attendance, 100),
    individualPlan: num(src.individualPlan, 0),
    dissertationProgress: num(src.dissertationProgress, 0),
    scientificActivity: num(src.scientificActivity, 0),
    academicDebtCount: num(src.academicDebtCount, 0),
    documentsCompleteness: num(src.documentsCompleteness, 0),
    dissertationStage: num(src.dissertationStage, 1),
    notes: clean(src.notes),
    createdBy: req.user._id
  };
}

function buildListQuery(req) {
  const q = clean(req.query.q);
  const query = scopeQueryForUser(req.user, {});
  if (req.query.status && ['green','yellow','red'].includes(req.query.status)) query.status = req.query.status;
  if (req.query.studyStatus && ['active','academic_leave','graduated','expelled'].includes(req.query.studyStatus)) query.studyStatus = req.query.studyStatus;
  ['faculty','department','specialty','group'].forEach(k => { if (clean(req.query[k])) query[k] = clean(req.query[k]); });
  if (req.query.course) query.course = Number(req.query.course);
  if (q) {
    query.$or = [{ fullName: rx(q) }, { group: rx(q) }, { specialty: rx(q) }, { studentId: rx(q) }];
    if (['superadmin','tech','magistracy','dean','department','supervisor','student'].includes(req.user.role)) query.$or.push({ phone: rx(q) }, { email: rx(q) }, { telegram: rx(q) });
  }
  return { query, q };
}

exports.list = async (req, res, next) => {
  try {
    const { query, q } = buildListQuery(req);
    const students = await Student.find(query).populate('supervisor','fullName avatarPath role').populate('user','fullName role avatarPath').sort({ fullName: 1 }).lean();
    const scoped = scopeQueryForUser(req.user, {});
    const bulkSupervisorQuery = { role:{ $in:['supervisor','teacher'] }, active:true };
    if (req.user.role === 'dean') bulkSupervisorQuery.faculty = req.user.faculty;
    if (req.user.role === 'department') bulkSupervisorQuery.department = req.user.department;
    const [faculties, departments, specialties, groups, structures, supervisors] = await Promise.all([
      Student.distinct('faculty', scoped), Student.distinct('department', scoped), Student.distinct('specialty', scoped), Student.distinct('group', scoped),
      AcademicStructure.find(structureScope(req.user)).sort({faculty:1,department:1,specialty:1,group:1}).lean(),
      User.find(bulkSupervisorQuery).select('fullName faculty department').sort({fullName:1}).lean()
    ]);
    const filters = {
      q,
      status: req.query.status || '', studyStatus: req.query.studyStatus || '', course: req.query.course || '',
      faculty: req.query.faculty || '', department: req.query.department || '', specialty: req.query.specialty || '', group: req.query.group || ''
    };
    res.render('students/list', { title: 'Magistrantlar bazasi', students, filters, faculties: faculties.filter(Boolean).sort(), departments: departments.filter(Boolean).sort(), specialties: specialties.filter(Boolean).sort(), groups: groups.filter(Boolean).sort(), structures, supervisors, canEdit: ENTRY_ROLES.includes(req.user.role) });
  } catch (e) { next(e); }
};

exports.newForm = async (req, res, next) => {
  try {
    const data = await loadEntryData(req);
    const preset = req.query.clear === '1' ? {} : (req.session.studentEntryPreset || {});
    if (req.query.clear === '1') delete req.session.studentEntryPreset;
    res.render('students/new', { title: 'Magistrant qo‘shish', ...data, preset, currentYear: new Date().getFullYear() });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const payload = buildStudentPayload(req.body, req);
    if (!payload.fullName) {
      req.session.flash = { type: 'error', text: 'F.I.Sh. majburiy.' };
      return res.redirect('/students/new');
    }
    if (payload.studentId && await Student.exists({ studentId: payload.studentId })) {
      req.session.flash = { type: 'error', text: `Talaba ID band: ${payload.studentId}` };
      return res.redirect('/students/new');
    }
    const student = new Student(payload);
    student.recalculateStatus();
    await student.save();
    await audit(req, 'STUDENT_CREATED', 'Student', student._id, { quick: false });

    req.session.studentEntryPreset = {
      faculty: student.faculty, department: student.department, specialty: student.specialty, group: student.group,
      course: student.course, admissionYear: student.admissionYear, educationForm: student.educationForm,
      supervisor: student.supervisor ? String(student.supervisor) : ''
    };
    if (req.body.submitAction === 'save-add') {
      req.session.flash = { type: 'success', text: `${student.fullName} saqlandi. Keyingi magistrantni kiriting.` };
      return res.redirect('/students/new');
    }
    if (req.body.submitAction === 'save-list') {
      req.session.flash = { type: 'success', text: `${student.fullName} saqlandi.` };
      return res.redirect('/students');
    }
    res.redirect(`/students/${student._id}`);
  } catch (e) { next(e); }
};

exports.quickForm = async (req, res, next) => {
  try {
    const data = await loadEntryData(req);
    const preset = req.session.studentEntryPreset || {};
    res.render('students/quick', { title: 'Tezkor kiritish', ...data, preset, currentYear: new Date().getFullYear() });
  } catch (e) { next(e); }
};

exports.quickCreate = async (req, res, next) => {
  try {
    const shared = {
      faculty: req.body.faculty, department: req.body.department, specialty: req.body.specialty, group: req.body.group,
      course: req.body.course, admissionYear: req.body.admissionYear, educationForm: req.body.educationForm,
      supervisor: req.body.supervisor
    };
    applyScopeToBody(req, shared);
    const rows = Array.isArray(req.body.rows) ? req.body.rows : Object.values(req.body.rows || {});
    let created = 0, skipped = 0;
    const skippedNames = [];
    for (const row of rows) {
      if (!clean(row?.fullName)) continue;
      const payload = buildStudentPayload(row, req, shared);
      if (payload.studentId && await Student.exists({ studentId: payload.studentId })) {
        skipped++; skippedNames.push(`${payload.fullName} (${payload.studentId})`); continue;
      }
      const student = new Student(payload); student.recalculateStatus(); await student.save(); created++;
    }
    req.session.studentEntryPreset = { ...shared };
    await audit(req, 'STUDENTS_QUICK_CREATED', 'Student', null, { created, skipped });
    req.session.flash = {
      type: skipped ? 'warning' : 'success',
      text: `${created} ta magistrant saqlandi.${skipped ? ` ${skipped} ta takroriy ID o‘tkazib yuborildi: ${skippedNames.slice(0,3).join(', ')}` : ''}`
    };
    res.redirect(req.body.submitAction === 'save-list' ? '/students' : '/students/quick');
  } catch (e) { next(e); }
};

exports.checkDuplicate = async (req, res, next) => {
  try {
    const studentId = clean(req.query.studentId);
    const email = clean(req.query.email).toLowerCase();
    const clauses = [];
    if (studentId) clauses.push({ studentId });
    if (email) clauses.push({ email: rx(`^${email}$`) });
    if (!clauses.length) return res.json({ exists: false });
    const duplicateQuery = { $or: clauses };
    if (req.query.exclude) duplicateQuery._id = { $ne: req.query.exclude };
    const found = await Student.findOne(duplicateQuery).select('fullName studentId email').lean();
    res.json({ exists: !!found, student: found || null });
  } catch (e) { next(e); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const { query } = buildListQuery(req);
    const students = await Student.find(query).populate('supervisor','fullName').sort({fullName:1}).lean();
    const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const contactAllowed = ['superadmin','tech','magistracy','dean','department','supervisor','student'].includes(req.user.role);
    const headers = ['F.I.Sh.','Talaba ID','Fakultet','Kafedra','Mutaxassislik','Guruh','Kurs','Qabul yili','Ilmiy rahbar', ...(contactAllowed?['Telefon','E-mail']:[]), 'Davomat','O‘zlashtirish','Individual reja','Dissertatsiya','Ilmiy faollik','Hujjatlar','Qarz','Holat'];
    const rows = students.map(s => [s.fullName,s.studentId,s.faculty,s.department,s.specialty,s.group,s.course,s.admissionYear,s.supervisor?.fullName,...(contactAllowed?[s.phone,s.email]:[]),s.attendance,s.academicScore,s.individualPlan,s.dissertationProgress,s.scientificActivity,s.documentsCompleteness,s.academicDebtCount,s.status]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="md-magistrantlar.csv"');
    res.send(csv);
  } catch (e) { next(e); }
};

exports.bulkUpdate = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : (req.body.ids ? [req.body.ids] : []);
    if (!ids.length) {
      req.session.flash = { type:'warning', text:'Kamida bitta magistrantni belgilang.' };
      return res.redirect('/students');
    }
    const query = scopeQueryForUser(req.user, { _id: { $in: ids } });
    let update = {};
    if (req.body.action === 'supervisor') {
      if (!req.body.value) update.supervisor = null;
      else {
        const supervisorQuery = { _id:req.body.value, role:{ $in:['supervisor','teacher'] }, active:true };
        if (req.user.role === 'dean') supervisorQuery.faculty = req.user.faculty;
        if (req.user.role === 'department') supervisorQuery.department = req.user.department;
        const allowedSupervisor = await User.findOne(supervisorQuery).select('_id').lean();
        if (allowedSupervisor) update.supervisor = allowedSupervisor._id;
      }
    }
    else if (req.body.action === 'studyStatus' && ['active','academic_leave','graduated','expelled'].includes(req.body.value)) update.studyStatus = req.body.value;
    else if (req.body.action === 'structure') {
      const t = await AcademicStructure.findOne({ _id:req.body.value, ...structureScope(req.user) }).lean();
      if (t) update = { faculty:t.faculty, department:t.department, specialty:t.specialty, group:t.group, course:t.course, admissionYear:t.admissionYear, educationForm:t.educationForm };
    }
    if (!Object.keys(update).length) {
      req.session.flash = { type:'error', text:'Ommaviy amal noto‘g‘ri tanlandi.' };
      return res.redirect('/students');
    }
    const result = await Student.updateMany(query, { $set: update });
    await audit(req, 'STUDENTS_BULK_UPDATED', 'Student', null, { action:req.body.action, matched:result.matchedCount, modified:result.modifiedCount });
    req.session.flash = { type:'success', text:`${result.modifiedCount} ta magistrant yangilandi.` };
    res.redirect('/students');
  } catch (e) { next(e); }
};

exports.view = async (req, res, next) => {
  try {
    const query = scopeQueryForUser(req.user, { _id: req.params.id });
    const student = await Student.findOne(query).populate('supervisor','fullName email phone avatarPath role').populate('user','fullName role avatarPath faculty department').lean();
    if (!student) return res.status(404).render('errors/404', { title: 'Magistrant topilmadi' });
    const [scientificWorks, approvedSubmissions] = await Promise.all([
      ScientificActivity.find({
        student: student._id,
        status: { $in: ['accepted', 'published', 'completed'] }
      }).populate('submission', '_id applicationNo').sort({ date: -1, createdAt: -1 }).lean(),
      ResearchSubmission.find({ student: student._id, status: 'approved' })
        .select('applicationNo type title abstract completedAt updatedAt createdAt')
        .sort({ completedAt: -1, updatedAt: -1 })
        .lean()
    ]);
    const linkedSubmissionIds = new Set(scientificWorks.map(item => String(item.submission?._id || item.submission || '')).filter(Boolean));
    const activityFeed = [
      ...scientificWorks.map(item => ({
        key: `science-${item._id}`,
        kind: 'science',
        typeLabel: SCIENCE_TYPE_LABELS[item.type] || 'Ilmiy ish',
        title: item.title,
        summary: item.notes || '',
        organization: item.organization || '',
        date: item.date || item.updatedAt || item.createdAt,
        statusLabel: SCIENCE_STATUS_LABELS[item.status] || 'Yakunlangan',
        statusTone: 'green',
        score: Number(item.score || 0),
        externalUrl: safeHttpUrl(item.link),
        detailUrl: item.submission ? `/submissions/${item.submission._id || item.submission}` : '/science',
        applicationNo: item.submission?.applicationNo || ''
      })),
      ...approvedSubmissions.filter(item => !linkedSubmissionIds.has(String(item._id))).map(item => ({
        key: `submission-${item._id}`,
        kind: 'submission',
        typeLabel: SUBMISSION_TYPES[item.type] || 'Ilmiy material',
        title: item.title,
        summary: item.abstract || '',
        organization: 'MD ilmiy tasdiqlash tizimi',
        date: item.completedAt || item.updatedAt || item.createdAt,
        statusLabel: 'To‘liq tasdiqlangan',
        statusTone: 'green',
        score: 100,
        externalUrl: '',
        detailUrl: `/submissions/${item._id}`,
        applicationNo: item.applicationNo || ''
      }))
    ].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
    const portfolioStats = {
      total: activityFeed.length,
      publications: scientificWorks.filter(item => item.type === 'publication').length,
      conferences: scientificWorks.filter(item => item.type === 'conference').length,
      approved: approvedSubmissions.length
    };
    res.render('students/view', {
      title: student.fullName,
      student,
      stages,
      profileAccess: profileAccessFor(req.user, student),
      activityFeed,
      portfolioStats
    });
  } catch (e) { next(e); }
};

exports.editForm = async (req, res, next) => {
  try {
    const query = scopeQueryForUser(req.user, { _id: req.params.id });
    const student = await Student.findOne(query).lean();
    if (!student) return res.status(404).render('errors/404', { title:'Magistrant topilmadi' });
    const data = await loadEntryData(req);
    if (student.user && !data.studentAccounts.some(u => String(u._id) === String(student.user))) {
      const currentAccount = await User.findById(student.user).select('fullName login faculty department phone email employeeId').lean();
      if (currentAccount) data.studentAccounts.unshift(currentAccount);
    }
    res.render('students/edit', { title: `${student.fullName} — tahrirlash`, student, ...data, currentYear:new Date().getFullYear() });
  } catch (e) { next(e); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const query = scopeQueryForUser(req.user, { _id: req.params.id });
    const student = await Student.findOne(query);
    if (!student) return res.status(404).render('errors/404', { title:'Magistrant topilmadi' });
    const body = { ...req.body }; applyScopeToBody(req, body);
    const studentId = clean(body.studentId);
    if (studentId && await Student.exists({ studentId, _id: { $ne: student._id } })) {
      req.session.flash = { type:'error', text:`Talaba ID band: ${studentId}` };
      return res.redirect(`/students/${student._id}/edit`);
    }
    ['fullName','faculty','department','specialty','educationForm','group','dissertationTitle','phone','alternatePhone','email','telegram','region','district','currentAddress','permanentAddress','emergencyContactName','emergencyContactPhone','researchInterests','orcid','scholarUrl','notes'].forEach(k => { if (body[k] !== undefined) student[k] = clean(body[k]); });
    if (body.birthDate !== undefined) student.birthDate = body.birthDate ? new Date(body.birthDate) : undefined;
    student.profileUpdatedAt = new Date();
    student.studentId = studentId || undefined;
    if (body.user !== undefined) student.user = body.user || undefined;
    if (body.supervisor !== undefined) student.supervisor = body.supervisor || undefined;
    if (body.course) student.course = Number(body.course);
    if (body.admissionYear) student.admissionYear = Number(body.admissionYear);
    if (body.studyStatus && ['active','academic_leave','graduated','expelled'].includes(body.studyStatus)) student.studyStatus = body.studyStatus;
    student.recalculateStatus();
    await student.save();
    await audit(req, 'STUDENT_PROFILE_UPDATED', 'Student', student._id);
    req.session.flash = { type:'success', text:'Magistrant ma’lumotlari yangilandi.' };
    res.redirect(`/students/${student._id}`);
  } catch (e) { next(e); }
};

exports.updateProgress = async (req, res, next) => {
  try {
    const query = scopeQueryForUser(req.user, { _id: req.params.id });
    const student = await Student.findOne(query);
    if (!student) return res.status(404).render('errors/404', { title: 'Magistrant topilmadi' });
    ['attendance','academicScore','individualPlan','dissertationProgress','scientificActivity','academicDebtCount','documentsCompleteness','dissertationStage','notes'].forEach(k => {
      if (req.body[k] !== undefined) student[k] = ['notes'].includes(k) ? req.body[k] : Number(req.body[k]);
    });
    student.recalculateStatus();
    await student.save();
    await audit(req, 'STUDENT_PROGRESS_UPDATED', 'Student', student._id, { status: student.status });
    req.session.flash = { type: 'success', text: 'Monitoring ko‘rsatkichlari yangilandi.' };
    res.redirect(`/students/${student._id}`);
  } catch (e) { next(e); }
};


exports.selfProfile = async (req,res,next) => {
  try {
    const student = await Student.findOne({ user:req.user._id }).populate('supervisor','fullName email phone avatarPath role').populate('user','fullName role avatarPath').lean();
    if(!student) return res.status(404).render('errors/404',{title:'Magistrant profili topilmadi'});
    res.render('students/self-profile',{title:'Mening aloqa va profil ma’lumotlarim',student});
  } catch(e){ next(e); }
};

exports.updateSelfProfile = async (req,res,next) => {
  try {
    const student = await Student.findOne({ user:req.user._id });
    if(!student) return res.status(404).render('errors/404',{title:'Magistrant profili topilmadi'});
    const fields=['phone','alternatePhone','email','secondaryEmail','telegram','region','district','currentAddress','permanentAddress','emergencyContactName','emergencyContactPhone','emergencyContactRelation','researchInterests','orcid','scholarUrl','linkedinUrl','previousUniversity','bachelorSpecialty','languages','employer','jobTitle'];
    fields.forEach(k=>{ if(req.body[k]!==undefined) student[k]=clean(req.body[k]); });
    if(req.body.birthDate!==undefined) student.birthDate=req.body.birthDate?new Date(req.body.birthDate):undefined;
    if(req.body.employmentStatus && ['not_working','working','self_employed','other'].includes(req.body.employmentStatus)) student.employmentStatus=req.body.employmentStatus;
    student.profileUpdatedAt=new Date();
    student.recalculateProfileCompleteness();
    await student.save();
    // only contact fields are mirrored to the login account; academic structure remains staff-managed.
    await User.updateOne({_id:req.user._id},{$set:{phone:student.phone,email:student.email}});
    await audit(req,'STUDENT_SELF_PROFILE_UPDATED','Student',student._id,{profileCompleteness:student.profileCompleteness});
    req.session.flash={type:'success',text:`Shaxsiy profil saqlandi. To‘ldirilish: ${student.profileCompleteness}%.`};
    res.redirect('/students/me/profile');
  } catch(e){ next(e); }
};
