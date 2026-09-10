const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ResearchSubmission = require('../models/ResearchSubmission');
const Notification = require('../models/Notification');
const Upload = require('../models/Upload');
const Student = require('../models/Student');
const User = require('../models/User');
const ScientificActivity = require('../models/ScientificActivity');
const DocumentRecord = require('../models/DocumentRecord');
const audit = require('../services/audit');
const { notifyStage, notifyApplicant, notifyUsers } = require('../services/notifications');
const {
  WORKFLOW_STAGES,
  STAGE_LABELS,
  SUBMISSION_TYPES,
  STATUS_LABELS,
  STATUS_TONES,
  ACTION_LABELS,
  nextStage,
  buildStageProgress,
  canReview
} = require('../config/submissionWorkflow');

const STORAGE_DIR = path.join(__dirname, '../../storage/submissions');
const GLOBAL_VIEW_ROLES = ['superadmin', 'tech', 'management', 'magistracy'];
const VALID_STATUSES = Object.keys(STATUS_LABELS);
const clean = (value, max = 10000) => String(value ?? '').trim().slice(0, max);
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function workflowLocals() {
  return { WORKFLOW_STAGES, STAGE_LABELS, SUBMISSION_TYPES, STATUS_LABELS, STATUS_TONES, ACTION_LABELS };
}

function parseKeywords(value) {
  return [...new Set(clean(value, 1000).split(/[,;\n]/).map(x => x.trim()).filter(Boolean))].slice(0, 12);
}

function normalizeLink(value) {
  const raw = clean(value, 1000);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch (_) { return null; }
}

function validDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function combine(...queries) {
  const parts = queries.filter(q => q && Object.keys(q).length);
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

async function visibleFilter(user) {
  if (GLOBAL_VIEW_ROLES.includes(user.role)) return {};
  if (user.role === 'student') {
    const student = await Student.findOne({ user: user._id }).select('_id').lean();
    return student ? { student: student._id } : { _id: null };
  }
  if (user.role === 'supervisor') return { supervisor: user._id };
  if (user.role === 'dean') return user.faculty ? { faculty: user.faculty } : { _id: null };
  if (['department', 'teacher'].includes(user.role)) return user.department ? { department: user.department } : { _id: null };
  return { _id: null };
}

function pendingFilter(user) {
  if (user.role === 'superadmin') return { status: 'under_review' };
  if (user.role === 'teacher') return { status: 'under_review', currentStage: 'supervisor', supervisor: user._id };
  if (WORKFLOW_STAGES.includes(user.role)) return { status: 'under_review', currentStage: user.role };
  if (user.role === 'student') return { status: 'changes_requested' };
  return { _id: null };
}

function populateSubmission(query) {
  return query
    .populate('student', 'fullName studentId faculty department specialty group course dissertationTitle email phone')
    .populate('applicant', 'fullName role email phone')
    .populate('supervisor', 'fullName role email phone faculty department')
    .populate({ path: 'attachments', populate: { path: 'uploadedBy', select: 'fullName role' } })
    .populate('history.actor', 'fullName role')
    .populate('stageProgress.assignedTo', 'fullName role')
    .populate('stageProgress.actedBy', 'fullName role');
}

async function findVisibleSubmission(id, user, populated = false) {
  if (!mongoose.isValidObjectId(id)) return null;
  const filter = await visibleFilter(user);
  const query = ResearchSubmission.findOne(combine(filter, { _id: id }));
  return populated ? populateSubmission(query) : query;
}

function studentCanEdit(user, submission) {
  return user.role === 'student' && String(submission.applicant?._id || submission.applicant) === String(user._id) && ['draft', 'changes_requested'].includes(submission.status);
}

function studentCanSubmit(user, submission) {
  return studentCanEdit(user, submission);
}

function studentCanWithdraw(user, submission) {
  return user.role === 'student' && String(submission.applicant?._id || submission.applicant) === String(user._id) && submission.status === 'under_review';
}

function setStageProgress(submission, stage, status, actor, comment) {
  let row = submission.stageProgress.find(item => item.stage === stage);
  if (!row) {
    submission.stageProgress.push({ stage, status: 'waiting' });
    row = submission.stageProgress[submission.stageProgress.length - 1];
  }
  row.status = status;
  if (['pending', 'waiting'].includes(status)) {
    row.actedBy = undefined;
    row.actedAt = undefined;
    row.comment = undefined;
  } else {
    if (actor) row.actedBy = actor._id || actor;
    row.actedAt = ['approved', 'changes_requested', 'rejected'].includes(status) ? new Date() : undefined;
    row.comment = comment || undefined;
  }
  if (stage === 'supervisor' && submission.supervisor) row.assignedTo = submission.supervisor;
  return row;
}

function appendHistory(submission, actor, action, fromStage, toStage, comment) {
  submission.history.push({
    action,
    actor: actor?._id || actor,
    actorRole: actor?.role,
    fromStage,
    toStage,
    comment: clean(comment, 4000) || undefined,
    revision: submission.revision,
    createdAt: new Date()
  });
  submission.lastActionAt = new Date();
}

async function cleanupFiles(files = []) {
  await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
}

async function addUploads(files, submission, student, user, targetRevision = submission.revision) {
  const created = [];
  for (const file of files || []) {
    const item = new Upload({
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      category: submission.type === 'article' ? 'publication' : submission.type === 'conference_material' ? 'conference' : submission.type === 'defense_document' ? 'defense' : submission.type === 'thesis' ? 'thesis' : 'source',
      description: `${submission.applicationNo} · ${submission.title}`,
      faculty: student.faculty,
      department: student.department,
      student: student._id,
      submission: submission._id,
      submissionRevision: targetRevision,
      storageScope: 'protected',
      uploadedBy: user._id
    });
    item.path = `/submissions/${submission._id}/files/${item._id}`;
    await item.save();
    created.push(item);
  }
  submission.attachments.push(...created.map(item => item._id));
  return created;
}

async function safely(task) {
  try { return await task; }
  catch (error) { console.error('Workflow side-effect error:', error.message); return null; }
}

async function performSubmit(submission, actor) {
  if (!studentCanSubmit(actor, submission)) return { ok: false, error: 'Bu arizani hozir yuborib bo‘lmaydi.' };
  let activeSupervisor = submission.supervisor ? await User.findOne({ _id: submission.supervisor, role: { $in:['supervisor','teacher'] }, active: true }).select('_id') : null;
  if (!activeSupervisor) {
    const latestStudent = await Student.findById(submission.student).select('supervisor');
    if (latestStudent?.supervisor) activeSupervisor = await User.findOne({ _id: latestStudent.supervisor, role: { $in:['supervisor','teacher'] }, active: true }).select('_id');
  }
  if (!activeSupervisor) return { ok: false, error: 'Faol ilmiy rahbar biriktirilmagan. Magistratura bo‘limiga murojaat qiling.' };
  submission.supervisor = activeSupervisor._id;
  const supervisorStep = submission.stageProgress.find(item => item.stage === 'supervisor');
  if (supervisorStep) supervisorStep.assignedTo = activeSupervisor._id;
  if (!submission.attachments.length && !submission.externalLink) return { ok: false, error: 'Kamida bitta fayl yoki tashqi ilmiy havola kiriting.' };

  const isRevision = submission.status === 'changes_requested';
  const targetStage = isRevision && WORKFLOW_STAGES.includes(submission.resumeStage) ? submission.resumeStage : 'supervisor';
  const fromStage = submission.currentStage;
  if (isRevision) submission.revision += 1;
  setStageProgress(submission, targetStage, 'pending');
  submission.status = 'under_review';
  submission.currentStage = targetStage;
  submission.resumeStage = targetStage;
  submission.submittedAt = submission.submittedAt || new Date();
  submission.withdrawnAt = undefined;
  appendHistory(submission, actor, isRevision ? 'resubmitted' : 'submitted', fromStage, targetStage, isRevision ? `Versiya ${submission.revision} qayta yuborildi.` : 'Dastlabki ko‘rib chiqishga yuborildi.');
  await submission.save();
  await safely(notifyStage(targetStage, submission, actor, `${submission.applicationNo} — ${submission.title}`));
  return { ok: true, targetStage };
}

async function recalculateScience(studentId) {
  const rows = await ScientificActivity.find({ student: studentId }).lean();
  const score = rows.length ? Math.min(100, Math.round(rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length)) : 0;
  const student = await Student.findById(studentId);
  if (student) { student.scientificActivity = score; student.recalculateStatus(); await student.save(); }
}

async function recalculateDocuments(studentId) {
  const required = ['individual_plan', 'dissertation_topic', 'supervisor_info', 'seminar_minutes', 'report', 'publication', 'conference', 'attestation', 'defense'];
  const rows = await DocumentRecord.find({ student: studentId }).lean();
  const count = rows.filter(row => required.includes(row.type) && row.status === 'present').length;
  const student = await Student.findById(studentId);
  if (student) { student.documentsCompleteness = Math.round(count / required.length * 100); student.recalculateStatus(); await student.save(); }
}

async function syncApprovedSubmission(submission, actor) {
  const scienceTypes = {
    article: 'publication',
    conference_material: 'conference',
    research_report: 'research',
    seminar_material: 'seminar',
    thesis: 'publication'
  };
  const documentTypes = {
    dissertation_chapter: 'report',
    individual_plan: 'individual_plan',
    attestation_document: 'attestation',
    defense_document: 'defense'
  };
  if (scienceTypes[submission.type]) {
    await ScientificActivity.findOneAndUpdate(
      { submission: submission._id },
      {
        student: submission.student,
        type: scienceTypes[submission.type],
        title: submission.title,
        organization: 'MD ilmiy tasdiqlash jarayoni',
        date: new Date(),
        status: submission.type === 'article' || submission.type === 'thesis' ? 'accepted' : 'completed',
        score: 100,
        link: submission.externalLink,
        notes: `${submission.applicationNo} arizasi yakuniy tasdiqdan o‘tdi.`,
        createdBy: actor._id,
        submission: submission._id
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await recalculateScience(submission.student);
  }
  if (documentTypes[submission.type]) {
    await DocumentRecord.findOneAndUpdate(
      { submission: submission._id },
      {
        student: submission.student,
        type: documentTypes[submission.type],
        title: submission.title,
        status: 'present',
        upload: submission.attachments[0] || undefined,
        issueDate: new Date(),
        notes: `${submission.applicationNo} bo‘yicha barcha bosqichlarda tasdiqlangan.`,
        updatedBy: actor._id,
        submission: submission._id
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await recalculateDocuments(submission.student);
  }
}

exports.index = async (req, res, next) => {
  try {
    const base = await visibleFilter(req.user);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 20;
    const extra = {};
    if (VALID_STATUSES.includes(req.query.status)) extra.status = req.query.status;
    if (['student', ...WORKFLOW_STAGES, 'completed'].includes(req.query.stage)) extra.currentStage = req.query.stage;
    if (SUBMISSION_TYPES[req.query.type]) extra.type = req.query.type;
    const search = clean(req.query.q, 120);
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const studentIds = await Student.find({ $or: [{ fullName: regex }, { studentId: regex }, { group: regex }] }).distinct('_id');
      extra.$or = [{ applicationNo: regex }, { title: regex }, { abstract: regex }, { student: { $in: studentIds } }];
    }
    const query = combine(base, extra);
    const [submissions, total, totalCount, pending, approved, changes, rejected, drafts, reviewing, overdue] = await Promise.all([
      populateSubmission(ResearchSubmission.find(query)).sort({ lastActionAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ResearchSubmission.countDocuments(query),
      ResearchSubmission.countDocuments(base),
      ResearchSubmission.countDocuments(combine(base, pendingFilter(req.user))),
      ResearchSubmission.countDocuments(combine(base, { status: 'approved' })),
      ResearchSubmission.countDocuments(combine(base, { status: 'changes_requested' })),
      ResearchSubmission.countDocuments(combine(base, { status: 'rejected' })),
      ResearchSubmission.countDocuments(combine(base, { status: 'draft' })),
      ResearchSubmission.countDocuments(combine(base, { status: 'under_review' })),
      ResearchSubmission.countDocuments(combine(base, { status: 'under_review', targetDate: { $lt: new Date() } }))
    ]);
    res.render('submissions/index', {
      title: req.user.role === 'student' ? 'Mening ilmiy arizalarim' : 'Ilmiy arizalar navbati',
      submissions,
      stats: { total: totalCount, pending, approved, changes, rejected, drafts, reviewing, overdue },
      filters: { status: req.query.status || '', stage: req.query.stage || '', type: req.query.type || '', q: search },
      pagination: { page, pages: Math.max(1, Math.ceil(total / limit)), total },
      ...workflowLocals()
    });
  } catch (error) { next(error); }
};

exports.newForm = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('supervisor', 'fullName email phone').lean();
    res.render('submissions/new', { title: 'Yangi ilmiy ariza', student, ...workflowLocals() });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  let submission;
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      await cleanupFiles(req.files);
      req.session.flash = { type: 'error', text: 'Hisobingiz magistrant profiliga bog‘lanmagan.' };
      return res.redirect('/submissions/new');
    }
    if (!student.faculty || !student.department) {
      await cleanupFiles(req.files);
      req.session.flash = { type: 'error', text: 'Fakultet va kafedra biriktirilmaguncha ariza yaratib bo‘lmaydi.' };
      return res.redirect('/submissions/new');
    }
    const type = SUBMISSION_TYPES[req.body.type] ? req.body.type : 'other';
    const title = clean(req.body.title, 300);
    const abstract = clean(req.body.abstract, 8000);
    const link = normalizeLink(req.body.externalLink);
    if (title.length < 5 || abstract.length < 20) {
      await cleanupFiles(req.files);
      req.session.flash = { type: 'error', text: 'Ariza nomi kamida 5, qisqacha mazmuni kamida 20 belgi bo‘lsin.' };
      return res.redirect('/submissions/new');
    }
    if (link === null) {
      await cleanupFiles(req.files);
      req.session.flash = { type: 'error', text: 'Tashqi havola http:// yoki https:// bilan boshlanishi kerak.' };
      return res.redirect('/submissions/new');
    }
    submission = new ResearchSubmission({
      student: student._id,
      applicant: req.user._id,
      supervisor: student.supervisor || undefined,
      faculty: student.faculty,
      department: student.department,
      specialty: student.specialty,
      group: student.group,
      type,
      title,
      abstract,
      keywords: parseKeywords(req.body.keywords),
      externalLink: link,
      studentNote: clean(req.body.studentNote, 4000),
      priority: ['normal', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : 'normal',
      targetDate: validDate(req.body.targetDate),
      stageProgress: buildStageProgress(student.supervisor),
      createdBy: req.user._id
    });
    appendHistory(submission, req.user, 'created', null, 'student', 'Talaba qoralama ariza yaratdi.');
    await submission.save();
    await addUploads(req.files, submission, student, req.user);
    if (req.files?.length) appendHistory(submission, req.user, 'attachment_added', 'student', 'student', `${req.files.length} ta fayl biriktirildi.`);
    await submission.save();
    await audit(req, 'SUBMISSION_CREATED', 'ResearchSubmission', submission._id, { applicationNo: submission.applicationNo, type: submission.type, files: req.files?.length || 0 });

    if (req.body.submitAction === 'submit') {
      const result = await performSubmit(submission, req.user);
      req.session.flash = result.ok
        ? { type: 'success', text: `Ariza ${STAGE_LABELS[result.targetStage]} bosqichiga yuborildi.` }
        : { type: 'warning', text: `Qoralama saqlandi. ${result.error}` };
    } else req.session.flash = { type: 'success', text: 'Ariza qoralama sifatida saqlandi.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) {
    await cleanupFiles(req.files);
    if (submission?._id) await safely(Promise.all([Upload.deleteMany({ submission: submission._id }), ResearchSubmission.deleteOne({ _id: submission._id })]));
    next(error);
  }
};

exports.view = async (req, res, next) => {
  try {
    const submission = await findVisibleSubmission(req.params.id, req.user, true);
    if (!submission) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    await Notification.updateMany({ recipient: req.user._id, submission: submission._id, readAt: null }, { $set: { readAt: new Date() } });
    res.locals.unreadNotifications = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
    const permissions = {
      canEdit: studentCanEdit(req.user, submission),
      canSubmit: studentCanSubmit(req.user, submission),
      canWithdraw: studentCanWithdraw(req.user, submission),
      canReview: canReview(req.user, submission),
      canComment: !['draft', 'archived'].includes(submission.status) || req.user.role === 'superadmin',
      canAdmin: req.user.role === 'superadmin'
    };
    const supervisors = permissions.canAdmin
      ? await User.find({ role: { $in:['supervisor','teacher'] }, active: true }).select('fullName role faculty department').sort({ fullName: 1 }).lean()
      : [];
    res.render('submissions/show', { title: `${submission.applicationNo} — ariza`, submission, permissions, supervisors, ...workflowLocals() });
  } catch (error) { next(error); }
};

exports.save = async (req, res, next) => {
  let changesSaved = false;
  try {
    const submission = await ResearchSubmission.findOne({ _id: req.params.id, applicant: req.user._id });
    if (!submission || !studentCanEdit(req.user, submission)) {
      await cleanupFiles(req.files);
      return res.status(403).render('errors/403', { title: 'Arizani tahrirlash mumkin emas' });
    }
    if (req.body.recordVersion !== undefined && Number(req.body.recordVersion) !== submission.__v) {
      await cleanupFiles(req.files);
      req.session.flash = { type: 'warning', text: 'Ariza boshqa oynada yangilangan. Sahifani qayta ko‘rib, o‘zgarishni takrorlang.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    const title = clean(req.body.title, 300);
    const abstract = clean(req.body.abstract, 8000);
    const link = normalizeLink(req.body.externalLink);
    if (title.length < 5 || abstract.length < 20 || link === null) {
      await cleanupFiles(req.files);
      req.session.flash = { type: 'error', text: link === null ? 'Tashqi havola noto‘g‘ri.' : 'Nomi va qisqacha mazmunini to‘liq kiriting.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    submission.type = SUBMISSION_TYPES[req.body.type] ? req.body.type : submission.type;
    submission.title = title;
    submission.abstract = abstract;
    submission.keywords = parseKeywords(req.body.keywords);
    submission.externalLink = link;
    submission.studentNote = clean(req.body.studentNote, 4000);
    submission.priority = ['normal', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : 'normal';
    submission.targetDate = validDate(req.body.targetDate);
    const student = await Student.findById(submission.student);
    const attachmentRevision = submission.status === 'changes_requested' ? submission.revision + 1 : submission.revision;
    await addUploads(req.files, submission, student, req.user, attachmentRevision);
    appendHistory(submission, req.user, 'edited', 'student', 'student', req.files?.length ? `Ariza yangilandi va ${req.files.length} ta fayl qo‘shildi.` : 'Ariza ma’lumotlari yangilandi.');
    await submission.save();
    changesSaved = true;
    await audit(req, 'SUBMISSION_EDITED', 'ResearchSubmission', submission._id, { files: req.files?.length || 0, revision: submission.revision });
    if (req.body.submitAction === 'submit') {
      const result = await performSubmit(submission, req.user);
      req.session.flash = result.ok ? { type: 'success', text: `Ariza ${STAGE_LABELS[result.targetStage]} bosqichiga yuborildi.` } : { type: 'warning', text: result.error };
    } else req.session.flash = { type: 'success', text: 'O‘zgarishlar qoralamada saqlandi.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) {
    if (!changesSaved) {
      await cleanupFiles(req.files);
      if (req.files?.length) await safely(Upload.deleteMany({ storedName: { $in: req.files.map(file => file.filename) }, storageScope: 'protected' }));
    }
    if (error.name === 'VersionError') {
      req.session.flash = { type: 'warning', text: 'Bir vaqtda boshqa qaror saqlangan. Sahifani yangilang.' };
      return res.redirect(`/submissions/${req.params.id}`);
    }
    next(error);
  }
};

exports.submit = async (req, res, next) => {
  try {
    const submission = await ResearchSubmission.findOne({ _id: req.params.id, applicant: req.user._id });
    if (!submission) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    if (req.body.recordVersion !== undefined && Number(req.body.recordVersion) !== submission.__v) {
      req.session.flash = { type: 'warning', text: 'Ariza yangilangan. Qayta tekshirib yuboring.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    const result = await performSubmit(submission, req.user);
    await audit(req, result.ok ? 'SUBMISSION_SUBMITTED' : 'SUBMISSION_SUBMIT_BLOCKED', 'ResearchSubmission', submission._id, { reason: result.error, stage: result.targetStage });
    req.session.flash = result.ok ? { type: 'success', text: `Ariza ${STAGE_LABELS[result.targetStage]}ga yuborildi.` } : { type: 'warning', text: result.error };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) {
    if (error.name === 'VersionError') {
      req.session.flash = { type: 'warning', text: 'Ariza boshqa oynada o‘zgargan. Sahifani yangilang.' };
      return res.redirect(`/submissions/${req.params.id}`);
    }
    next(error);
  }
};

exports.decision = async (req, res, next) => {
  try {
    const submission = await findVisibleSubmission(req.params.id, req.user);
    if (!submission || !canReview(req.user, submission)) return res.status(403).render('errors/403', { title: 'Bu bosqich bo‘yicha qaror berish vakolati yo‘q' });
    if (req.body.recordVersion !== undefined && Number(req.body.recordVersion) !== submission.__v) {
      req.session.flash = { type: 'warning', text: 'Bu ariza bo‘yicha boshqa foydalanuvchi qaror saqlagan. Sahifani yangilang.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    const decision = req.body.decision;
    const comment = clean(req.body.comment, 4000);
    if (!['approve', 'changes', 'reject'].includes(decision) || comment.length < 3) {
      req.session.flash = { type: 'error', text: 'Qarorni tanlang va mazmunli sharh yozing.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    const stage = submission.currentStage;
    let auditAction;
    if (decision === 'approve') {
      setStageProgress(submission, stage, 'approved', req.user, comment);
      const next = nextStage(stage);
      appendHistory(submission, req.user, 'approved', stage, next || 'completed', comment);
      if (next) {
        setStageProgress(submission, next, 'pending');
        submission.currentStage = next;
        submission.resumeStage = next;
        submission.status = 'under_review';
      } else {
        submission.currentStage = 'completed';
        submission.status = 'approved';
        submission.completedAt = new Date();
        submission.resumeStage = undefined;
      }
      auditAction = 'SUBMISSION_APPROVED_STAGE';
    } else if (decision === 'changes') {
      setStageProgress(submission, stage, 'changes_requested', req.user, comment);
      appendHistory(submission, req.user, 'changes_requested', stage, 'student', comment);
      submission.status = 'changes_requested';
      submission.resumeStage = stage;
      submission.currentStage = 'student';
      auditAction = 'SUBMISSION_CHANGES_REQUESTED';
    } else {
      setStageProgress(submission, stage, 'rejected', req.user, comment);
      appendHistory(submission, req.user, 'rejected', stage, stage, comment);
      submission.status = 'rejected';
      submission.resumeStage = stage;
      auditAction = 'SUBMISSION_REJECTED';
    }
    await submission.save();
    if (submission.status === 'approved') await safely(syncApprovedSubmission(submission, req.user));
    await audit(req, auditAction, 'ResearchSubmission', submission._id, { applicationNo: submission.applicationNo, stage, decision, adminOverride: req.user.role === 'superadmin' });

    const actorLabel = req.user.role === 'superadmin' ? 'Bosh administrator' : STAGE_LABELS[stage];
    const decisionText = decision === 'approve' ? 'ma’qulladi' : decision === 'changes' ? 'tuzatishga qaytardi' : 'rad etdi';
    await safely(notifyApplicant(submission, req.user, `${submission.applicationNo}: qaror`, `${actorLabel} arizani ${decisionText}. Sharh: ${comment}`));
    if (decision === 'approve' && submission.status === 'under_review') {
      await safely(notifyStage(submission.currentStage, submission, req.user, `${submission.applicationNo} oldingi bosqichdan ma’qullanib keldi.`));
    }
    req.session.flash = { type: decision === 'approve' ? 'success' : decision === 'changes' ? 'warning' : 'error', text: decision === 'approve' ? (submission.status === 'approved' ? 'Ariza barcha bosqichlardan o‘tdi va yakuniy tasdiqlandi.' : `Ma’qullandi va ${STAGE_LABELS[submission.currentStage]} bosqichiga yuborildi.`) : decision === 'changes' ? 'Ariza sharh bilan talabaga tuzatishga qaytarildi.' : 'Ariza rad etildi.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) {
    if (error.name === 'VersionError') {
      req.session.flash = { type: 'warning', text: 'Qarorlar to‘qnashuvi: boshqa foydalanuvchi avvalroq amal bajargan.' };
      return res.redirect(`/submissions/${req.params.id}`);
    }
    next(error);
  }
};

exports.comment = async (req, res, next) => {
  try {
    const submission = await findVisibleSubmission(req.params.id, req.user);
    if (!submission || submission.status === 'archived') return res.status(403).render('errors/403', { title: 'Sharh yozish mumkin emas' });
    const comment = clean(req.body.comment, 4000);
    if (comment.length < 2) {
      req.session.flash = { type: 'warning', text: 'Sharh matnini kiriting.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    appendHistory(submission, req.user, 'commented', submission.currentStage, submission.currentStage, comment);
    await submission.save();
    await audit(req, 'SUBMISSION_COMMENTED', 'ResearchSubmission', submission._id, { applicationNo: submission.applicationNo });
    if (req.user.role === 'student' && submission.status === 'under_review') {
      await safely(notifyStage(submission.currentStage, submission, req.user, `${submission.applicationNo} bo‘yicha magistrant yangi sharh yozdi.`));
    } else {
      await safely(notifyApplicant(submission, req.user, `${submission.applicationNo}: yangi sharh`, `${req.user.fullName}: ${comment}`, 'comment'));
    }
    req.session.flash = { type: 'success', text: 'Sharh tarixga qo‘shildi.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) { next(error); }
};

exports.withdraw = async (req, res, next) => {
  try {
    const submission = await ResearchSubmission.findOne({ _id: req.params.id, applicant: req.user._id });
    if (!submission || !studentCanWithdraw(req.user, submission)) return res.status(403).render('errors/403', { title: 'Arizani qaytarib olish mumkin emas' });
    const stage = submission.currentStage;
    submission.status = 'withdrawn';
    submission.withdrawnAt = new Date();
    appendHistory(submission, req.user, 'withdrawn', stage, 'student', clean(req.body.comment, 4000) || 'Magistrant arizani ko‘rib chiqishdan qaytarib oldi.');
    await submission.save();
    await audit(req, 'SUBMISSION_WITHDRAWN', 'ResearchSubmission', submission._id, { stage });
    await safely(notifyStage(stage, submission, req.user, `${submission.applicationNo} magistrant tomonidan qaytarib olindi.`));
    req.session.flash = { type: 'warning', text: 'Ariza ko‘rib chiqishdan qaytarib olindi. Qayta ochish uchun administratorga murojaat qiling.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) { next(error); }
};

exports.removeAttachment = async (req, res, next) => {
  try {
    const submission = await ResearchSubmission.findOne({ _id: req.params.id, applicant: req.user._id });
    if (!submission || !studentCanEdit(req.user, submission)) return res.status(403).render('errors/403', { title: 'Faylni olib tashlash mumkin emas' });
    const file = await Upload.findOne({ _id: req.params.uploadId, submission: submission._id, storageScope: 'protected' });
    if (!file) return res.status(404).render('errors/404', { title: 'Fayl topilmadi' });
    submission.attachments.pull(file._id);
    appendHistory(submission, req.user, 'attachment_removed', 'student', 'student', file.originalName);
    await submission.save();
    await file.deleteOne();
    await fs.promises.unlink(path.join(STORAGE_DIR, path.basename(file.storedName || ''))).catch(() => {});
    await audit(req, 'SUBMISSION_ATTACHMENT_REMOVED', 'ResearchSubmission', submission._id, { uploadId: file._id, name: file.originalName });
    req.session.flash = { type: 'success', text: 'Fayl arizadan olib tashlandi.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) { next(error); }
};

exports.download = async (req, res, next) => {
  try {
    const submission = await findVisibleSubmission(req.params.id, req.user);
    if (!submission) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    const file = await Upload.findOne({ _id: req.params.uploadId, submission: submission._id, storageScope: 'protected' }).lean();
    if (!file) return res.status(404).render('errors/404', { title: 'Fayl topilmadi' });
    const absolutePath = path.join(STORAGE_DIR, path.basename(file.storedName || ''));
    if (!fs.existsSync(absolutePath)) return res.status(404).render('errors/404', { title: 'Fayl diskda topilmadi' });
    await audit(req, 'SUBMISSION_FILE_DOWNLOADED', 'Upload', file._id, { submission: submission._id });
    res.download(absolutePath, file.originalName);
  } catch (error) { next(error); }
};

exports.adminAction = async (req, res, next) => {
  try {
    const submission = await ResearchSubmission.findById(req.params.id);
    if (!submission) return res.status(404).render('errors/404', { title: 'Ariza topilmadi' });
    const action = req.body.adminAction;
    const comment = clean(req.body.comment, 4000);
    if (comment.length < 3) {
      req.session.flash = { type: 'warning', text: 'Administrator amalining sababini yozing.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    const oldStage = submission.currentStage;
    if (action === 'archive') {
      submission.status = 'archived';
      submission.currentStage = 'completed';
      submission.archivedAt = new Date();
      appendHistory(submission, req.user, 'archived', oldStage, 'completed', comment);
    } else if (action === 'reopen') {
      const resume = WORKFLOW_STAGES.includes(submission.resumeStage) ? submission.resumeStage : WORKFLOW_STAGES.includes(oldStage) ? oldStage : 'supervisor';
      submission.status = 'changes_requested';
      submission.currentStage = 'student';
      submission.resumeStage = resume;
      submission.completedAt = undefined;
      submission.archivedAt = undefined;
      appendHistory(submission, req.user, 'reopened', oldStage, 'student', comment);
    } else if (action === 'reroute' && WORKFLOW_STAGES.includes(req.body.stage)) {
      submission.status = 'under_review';
      submission.currentStage = req.body.stage;
      submission.resumeStage = req.body.stage;
      setStageProgress(submission, req.body.stage, 'pending');
      appendHistory(submission, req.user, 'rerouted', oldStage, req.body.stage, comment);
    } else if (action === 'reassign_supervisor') {
      const supervisor = await User.findOne({ _id: req.body.supervisor, role: { $in:['supervisor','teacher'] }, active: true });
      if (!supervisor) {
        req.session.flash = { type: 'error', text: 'Yangi ilmiy rahbar topilmadi.' };
        return res.redirect(`/submissions/${submission._id}`);
      }
      submission.supervisor = supervisor._id;
      let row = submission.stageProgress.find(x => x.stage === 'supervisor');
      if (!row) { submission.stageProgress.push({ stage:'supervisor', status:'waiting' }); row=submission.stageProgress[submission.stageProgress.length-1]; }
      if (submission.currentStage === 'supervisor' && submission.status === 'under_review') { row.status='pending'; row.actedBy=undefined; row.actedAt=undefined; row.comment=undefined; }
      row.assignedTo = supervisor._id;
      if (req.body.updateStudent === 'on') await Student.updateOne({ _id: submission.student }, { $set: { supervisor: supervisor._id } });
      appendHistory(submission, req.user, 'supervisor_reassigned', oldStage, oldStage, `${comment} Yangi rahbar: ${supervisor.fullName}.`);
      await safely(notifyUsers([supervisor._id], { type: 'submission', title: 'Ilmiy ariza biriktirildi', message: `${submission.applicationNo} sizga biriktirildi.`, link: `/submissions/${submission._id}`, submission: submission._id, createdBy: req.user._id }));
    } else {
      req.session.flash = { type: 'error', text: 'Administrator amali noto‘g‘ri tanlandi.' };
      return res.redirect(`/submissions/${submission._id}`);
    }
    await submission.save();
    await audit(req, 'SUBMISSION_ADMIN_ACTION', 'ResearchSubmission', submission._id, { action, from: oldStage, to: submission.currentStage, comment });
    await safely(notifyApplicant(submission, req.user, `${submission.applicationNo}: administrator amali`, comment, 'system'));
    if (action === 'reroute') await safely(notifyStage(submission.currentStage, submission, req.user, `${submission.applicationNo} administrator tomonidan navbatga yo‘naltirildi.`));
    req.session.flash = { type: 'success', text: 'Administrator amali bajarildi va auditga yozildi.' };
    res.redirect(`/submissions/${submission._id}`);
  } catch (error) { next(error); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const filter = await visibleFilter(req.user);
    const rows = await ResearchSubmission.find(filter).populate('student', 'fullName studentId').populate('supervisor', 'fullName').sort({ createdAt: -1 }).lean();
    const headers = ['Ariza raqami', 'Magistrant', 'Talaba ID', 'Tur', 'Nomi', 'Fakultet', 'Kafedra', 'Ilmiy rahbar', 'Holat', 'Joriy bosqich', 'Versiya', 'Yaratilgan', 'Yakunlangan'];
    const data = rows.map(item => [item.applicationNo, item.student?.fullName, item.student?.studentId, SUBMISSION_TYPES[item.type], item.title, item.faculty, item.department, item.supervisor?.fullName, STATUS_LABELS[item.status], STAGE_LABELS[item.currentStage], item.revision, item.createdAt?.toISOString(), item.completedAt?.toISOString() || '']);
    const esc = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers, ...data].map(row => row.map(esc).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="md-ilmiy-arizalar-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
};
