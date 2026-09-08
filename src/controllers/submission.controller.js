const fs = require('fs');
const path = require('path');
const SubmissionApplication = require('../models/SubmissionApplication');
const Student = require('../models/Student');
const Upload = require('../models/Upload');
const ScientificActivity = require('../models/ScientificActivity');
const User = require('../models/User');
const audit = require('../services/audit');
const {
  STAGE_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  flowForType,
  nextStage,
  visibilityFilterForUser,
  pendingFilterForUser,
  canView,
  canReview,
  canComment
} = require('../services/submissionWorkflow');

const POPULATE = [
  { path: 'student', select: 'fullName studentId faculty department specialty group course dissertationTitle user' },
  { path: 'supervisor', select: 'fullName role faculty department email phone' },
  { path: 'createdBy', select: 'fullName role' },
  { path: 'attachments', select: 'originalName path size category createdAt' },
  { path: 'history.actor', select: 'fullName role' }
];

function fileCategory(type) {
  if (type === 'publication') return 'publication';
  if (type === 'conference') return 'conference';
  if (['dissertation','thesis'].includes(type)) return 'thesis';
  if (type === 'defense') return 'defense';
  if (type === 'report') return 'report';
  if (type === 'document') return 'document';
  return 'source';
}

async function createUploads(req, student, files, type) {
  const ids = [];
  for (const file of (files || [])) {
    const item = await Upload.create({
      originalName: file.originalname,
      storedName: file.filename,
      path: `/static/uploads/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      category: fileCategory(type),
      description: `Ilmiy ariza: ${req.body.title || type}`,
      faculty: student.faculty,
      department: student.department,
      student: student._id,
      uploadedBy: req.user._id
    });
    ids.push(item._id);
    await audit(req, 'SUBMISSION_FILE_UPLOADED', 'Upload', item._id, { name: item.originalName, type });
  }
  return ids;
}

async function loadItem(id) {
  return SubmissionApplication.findById(id).populate(POPULATE);
}

async function reviewerExists(stage, item) {
  if (stage === 'completed') return true;
  if (stage === 'supervisor') return !!(await User.exists({ _id:item.supervisor, role:'supervisor', active:true }));
  if (stage === 'department') return !!(await User.exists({ role:'department', department:item.department, active:true }));
  if (stage === 'dean') return !!(await User.exists({ role:'dean', faculty:item.faculty, active:true }));
  if (stage === 'magistracy') return !!(await User.exists({ role:'magistracy', active:true }));
  if (stage === 'management') return !!(await User.exists({ role:'management', active:true }));
  return false;
}

async function syncScientificActivity(req, item) {
  if (!['publication','conference','research','seminar'].includes(item.type)) return;
  if (item.scientificActivity) return;
  const science = await ScientificActivity.create({
    student: item.student._id || item.student,
    type: item.type,
    title: item.title,
    organization: item.organization,
    date: item.eventDate || item.finalApprovedAt || new Date(),
    status: item.type === 'publication' ? 'accepted' : 'completed',
    score: 100,
    link: item.link,
    notes: `Ariza workflow orqali yakuniy ma’qullangan. Revision: ${item.revision}`,
    createdBy: req.user._id
  });
  item.scientificActivity = science._id;
  const student = await Student.findById(item.student._id || item.student);
  if (student) {
    const rows = await ScientificActivity.find({ student: student._id }).lean();
    student.scientificActivity = rows.length ? Math.min(100, Math.round(rows.reduce((n, x) => n + Number(x.score || 0), 0) / rows.length)) : 0;
    student.recalculateStatus();
    await student.save();
  }
}

exports.index = async (req, res, next) => {
  try {
    const visibility = visibilityFilterForUser(req.user);
    const filter = { ...visibility };
    if (req.query.status && ['in_review','needs_revision','rejected','approved'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.type && TYPE_LABELS[req.query.type]) filter.type = req.query.type;
    if (req.query.stage && STAGE_LABELS[req.query.stage]) filter.currentStage = req.query.stage;
    if (req.query.q) {
      const term = String(req.query.q).trim().slice(0, 100);
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { department: { $regex: term, $options: 'i' } },
        { faculty: { $regex: term, $options: 'i' } },
        { group: { $regex: term, $options: 'i' } }
      ];
    }

    const [items, total, inReview, revision, rejected, approved, pending] = await Promise.all([
      SubmissionApplication.find(filter).populate(POPULATE).sort({ updatedAt: -1 }).limit(300).lean(),
      SubmissionApplication.countDocuments(visibility),
      SubmissionApplication.countDocuments({ ...visibility, status: 'in_review' }),
      SubmissionApplication.countDocuments({ ...visibility, status: 'needs_revision' }),
      SubmissionApplication.countDocuments({ ...visibility, status: 'rejected' }),
      SubmissionApplication.countDocuments({ ...visibility, status: 'approved' }),
      SubmissionApplication.countDocuments(pendingFilterForUser(req.user))
    ]);

    res.render('submissions/index', {
      title: 'Ilmiy arizalar', items, total, inReview, revision, rejected, approved, pending,
      typeLabels: TYPE_LABELS, stageLabels: STAGE_LABELS, statusLabels: STATUS_LABELS, query: req.query
    });
  } catch (e) { next(e); }
};

exports.newForm = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('supervisor','fullName department faculty').lean();
    res.render('submissions/new', {
      title: 'Yangi ilmiy ariza', student,
      typeLabels: TYPE_LABELS, stageLabels: STAGE_LABELS,
      flowForType
    });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      req.session.flash = { type: 'error', text: 'Magistrant profilingiz hisobga bog‘lanmagan.' };
      return res.redirect('/submissions/new');
    }
    if (!student.supervisor) {
      req.session.flash = { type: 'error', text: 'Ilmiy rahbar biriktirilmagan. Ariza yuborishdan oldin magistratura/kafedra xodimiga murojaat qiling.' };
      return res.redirect('/submissions/new');
    }
    if (!(await reviewerExists('supervisor', { supervisor: student.supervisor }))) {
      req.session.flash = { type: 'error', text: 'Biriktirilgan ilmiy rahbar hisobi faol emas yoki roli noto‘g‘ri. Kafedra/texnik xodimdan hisobni tekshirtiring.' };
      return res.redirect('/submissions/new');
    }
    const type = TYPE_LABELS[req.body.type] ? req.body.type : 'other';
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title || !description) {
      req.session.flash = { type: 'error', text: 'Ariza nomi va qisqacha mazmuni majburiy.' };
      return res.redirect('/submissions/new');
    }
    if (!req.files || !req.files.length) {
      req.session.flash = { type: 'error', text: 'Kamida bitta source/hujjat faylini biriktiring.' };
      return res.redirect('/submissions/new');
    }

    const attachmentIds = await createUploads(req, student, req.files, type);
    const flow = flowForType(type);
    const item = await SubmissionApplication.create({
      student: student._id,
      createdBy: req.user._id,
      supervisor: student.supervisor,
      faculty: student.faculty,
      department: student.department,
      group: student.group,
      specialty: student.specialty,
      type,
      title,
      description,
      organization: req.body.organization,
      eventDate: req.body.eventDate || undefined,
      link: req.body.link,
      keywords: req.body.keywords,
      attachments: attachmentIds,
      status: 'in_review',
      currentStage: flow[0],
      history: [{
        stage: 'student', actorRole: 'student', actor: req.user._id, action: 'submitted',
        comment: String(req.body.studentComment || '').trim() || 'Ariza ko‘rib chiqish uchun yuborildi.',
        fromStage: 'student', toStage: flow[0], revision: 1
      }]
    });
    await audit(req, 'SUBMISSION_CREATED', 'SubmissionApplication', item._id, { type, stage: flow[0], title });
    req.session.flash = { type: 'success', text: 'Ariza ilmiy rahbarga yuborildi.' };
    res.redirect(`/submissions/${item._id}`);
  } catch (e) { next(e); }
};

exports.view = async (req, res, next) => {
  try {
    const item = await loadItem(req.params.id);
    if (!item) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    if (!canView(req.user, item)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    res.render('submissions/view', {
      title: 'Ilmiy ariza', item,
      typeLabels: TYPE_LABELS, stageLabels: STAGE_LABELS, statusLabels: STATUS_LABELS,
      flow: flowForType(item.type),
      canReviewCurrent: canReview(req.user, item),
      canCommentCurrent: canComment(req.user, item)
    });
  } catch (e) { next(e); }
};

exports.comment = async (req, res, next) => {
  try {
    const item = await SubmissionApplication.findById(req.params.id);
    if (!item) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    if (!canComment(req.user, item)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    const comment = String(req.body.comment || '').trim();
    if (!comment) {
      req.session.flash = { type: 'error', text: 'Sharh matnini kiriting.' };
      return res.redirect(`/submissions/${item._id}`);
    }
    item.history.push({
      stage: item.currentStage === 'completed' ? 'completed' : item.currentStage,
      actorRole: req.user.role, actor: req.user._id, action: 'comment', comment,
      fromStage: item.currentStage, toStage: item.currentStage, revision: item.revision
    });
    await item.save();
    await audit(req, 'SUBMISSION_COMMENTED', 'SubmissionApplication', item._id, { stage: item.currentStage });
    req.session.flash = { type: 'success', text: 'Sharh qo‘shildi.' };
    res.redirect(`/submissions/${item._id}`);
  } catch (e) { next(e); }
};

exports.decision = async (req, res, next) => {
  try {
    const item = await SubmissionApplication.findById(req.params.id);
    if (!item) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    if (!canReview(req.user, item)) return res.status(403).render('errors/403', { title: 'Bu bosqichni ko‘rib chiqish vakolati sizda yo‘q' });

    const decision = String(req.body.decision || '');
    const comment = String(req.body.comment || '').trim();
    if (!['approve','revision','reject'].includes(decision)) {
      req.session.flash = { type: 'error', text: 'Qaror turi noto‘g‘ri.' };
      return res.redirect(`/submissions/${item._id}`);
    }
    if (!comment) {
      req.session.flash = { type: 'error', text: 'Har bir qaror uchun sharh majburiy.' };
      return res.redirect(`/submissions/${item._id}`);
    }

    const fromStage = item.currentStage;
    item.lastDecisionAt = new Date();

    if (decision === 'approve') {
      const to = nextStage(item.type, fromStage);
      if (to !== 'completed' && !(await reviewerExists(to, item))) {
        req.session.flash = { type: 'error', text: `${STAGE_LABELS[to]} uchun faol mas’ul hisob topilmadi. Admin/texnik xodim avval tegishli rol hisobini biriktirsin.` };
        return res.redirect(`/submissions/${item._id}`);
      }
      item.history.push({
        stage: fromStage, actorRole: req.user.role, actor: req.user._id, action: 'approved',
        comment, fromStage, toStage: to, revision: item.revision
      });
      if (to === 'completed') {
        item.status = 'approved';
        item.currentStage = 'completed';
        item.finalApprovedAt = new Date();
        item.history.push({
          stage: 'completed', actorRole: req.user.role, actor: req.user._id, action: 'forwarded',
          comment: 'Barcha tasdiqlash bosqichlari yakunlandi.', fromStage, toStage: 'completed', revision: item.revision
        });
        await syncScientificActivity(req, item);
      } else {
        item.currentStage = to;
        item.status = 'in_review';
        item.history.push({
          stage: to, actorRole: req.user.role, actor: req.user._id, action: 'forwarded',
          comment: `${STAGE_LABELS[to]} bosqichiga yuborildi.`, fromStage, toStage: to, revision: item.revision
        });
      }
    } else if (decision === 'revision') {
      item.returnStage = fromStage;
      item.currentStage = 'student';
      item.status = 'needs_revision';
      item.history.push({
        stage: fromStage, actorRole: req.user.role, actor: req.user._id, action: 'revision',
        comment, fromStage, toStage: 'student', revision: item.revision
      });
    } else {
      item.status = 'rejected';
      item.rejectedAt = new Date();
      item.history.push({
        stage: fromStage, actorRole: req.user.role, actor: req.user._id, action: 'rejected',
        comment, fromStage, toStage: fromStage, revision: item.revision
      });
    }

    await item.save();
    await audit(req, 'SUBMISSION_DECISION', 'SubmissionApplication', item._id, { decision, fromStage, toStage: item.currentStage });
    req.session.flash = {
      type: decision === 'approve' ? 'success' : decision === 'revision' ? 'warning' : 'error',
      text: decision === 'approve' ? 'Ma’qullandi va keyingi bosqichga yuborildi.' : decision === 'revision' ? 'Talabaga qayta ishlash uchun yuborildi.' : 'Ariza rad etildi.'
    };
    res.redirect(`/submissions/${item._id}`);
  } catch (e) { next(e); }
};

exports.resubmit = async (req, res, next) => {
  try {
    const item = await SubmissionApplication.findById(req.params.id);
    if (!item) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    if (req.user.role !== 'student' || String(item.createdBy) !== String(req.user._id)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    if (item.status !== 'needs_revision' || item.currentStage !== 'student' || !item.returnStage) {
      req.session.flash = { type: 'error', text: 'Bu ariza hozir qayta yuborish holatida emas.' };
      return res.redirect(`/submissions/${item._id}`);
    }
    const student = await Student.findById(item.student);
    if (!student) return res.status(404).render('errors/404', { title: 'Magistrant topilmadi' });

    if (req.files && req.files.length) {
      const ids = await createUploads(req, student, req.files, item.type);
      item.attachments.push(...ids);
    }
    if (req.body.title) item.title = String(req.body.title).trim();
    if (req.body.description) item.description = String(req.body.description).trim();
    if (req.body.organization !== undefined) item.organization = req.body.organization;
    if (req.body.link !== undefined) item.link = req.body.link;
    if (req.body.keywords !== undefined) item.keywords = req.body.keywords;

    const to = item.returnStage;
    item.revision += 1;
    item.status = 'in_review';
    item.currentStage = to;
    item.returnStage = undefined;
    item.submittedAt = new Date();
    item.history.push({
      stage: 'student', actorRole: 'student', actor: req.user._id, action: 'resubmitted',
      comment: String(req.body.comment || '').trim() || 'Talab qilingan tuzatishlar kiritildi va qayta yuborildi.',
      fromStage: 'student', toStage: to, revision: item.revision
    });
    await item.save();
    await audit(req, 'SUBMISSION_RESUBMITTED', 'SubmissionApplication', item._id, { toStage: to, revision: item.revision });
    req.session.flash = { type: 'success', text: `Ariza ${STAGE_LABELS[to]} bosqichiga qayta yuborildi.` };
    res.redirect(`/submissions/${item._id}`);
  } catch (e) { next(e); }
};

exports.adminEdit = async (req, res, next) => {
  try {
    const item = await SubmissionApplication.findById(req.params.id);
    if (!item) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    ['title','description','organization','link','keywords'].forEach(k => {
      if (req.body[k] !== undefined) item[k] = String(req.body[k]).trim();
    });
    if (TYPE_LABELS[req.body.type]) item.type = req.body.type;
    item.history.push({
      stage: item.currentStage, actorRole: req.user.role, actor: req.user._id, action: 'admin_edit',
      comment: String(req.body.comment || '').trim() || 'Bosh administrator ariza metama’lumotlarini tahrirladi.',
      fromStage: item.currentStage, toStage: item.currentStage, revision: item.revision
    });
    await item.save();
    await audit(req, 'SUBMISSION_ADMIN_EDIT', 'SubmissionApplication', item._id, { type: item.type });
    req.session.flash = { type: 'success', text: 'Ariza ma’lumotlari tahrirlandi.' };
    res.redirect(`/submissions/${item._id}`);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const item = await SubmissionApplication.findById(req.params.id).populate('attachments');
    if (!item) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    for (const file of (item.attachments || [])) {
      if (file.storedName) {
        const localPath = path.join(__dirname, '../../public/uploads', file.storedName);
        try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (_) {}
      }
      await Upload.deleteOne({ _id: file._id });
    }
    await SubmissionApplication.deleteOne({ _id: item._id });
    await audit(req, 'SUBMISSION_DELETED', 'SubmissionApplication', item._id, { title: item.title });
    req.session.flash = { type: 'success', text: 'Ariza va unga biriktirilgan source fayllar o‘chirildi.' };
    res.redirect('/submissions');
  } catch (e) { next(e); }
};
