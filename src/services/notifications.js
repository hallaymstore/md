const User = require('../models/User');
const Notification = require('../models/Notification');
const { STAGE_LABELS } = require('../config/submissionWorkflow');

function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean).map(String))];
}

async function recipientsForStage(stage, submission) {
  if (stage === 'supervisor') {
    if (!submission.supervisor) return [];
    const supervisor = await User.findOne({ _id: submission.supervisor, role: { $in:['supervisor','teacher'] }, active: true }).select('_id').lean();
    return supervisor ? [supervisor._id] : [];
  }
  const query = { role: stage, active: true };
  if (stage === 'department') query.department = submission.department;
  if (stage === 'dean') query.faculty = submission.faculty;
  if (!['department', 'dean', 'magistracy', 'management'].includes(stage)) return [];
  const users = await User.find(query).select('_id').lean();
  return users.map(user => user._id);
}

async function notifyUsers(recipientIds, payload) {
  const ids = uniqueIds(recipientIds);
  if (!ids.length) return [];
  return Notification.insertMany(ids.map(recipient => ({ ...payload, recipient })), { ordered: false });
}

async function notifyStage(stage, submission, actor, message) {
  const ids = await recipientsForStage(stage, submission);
  const actorId = actor?._id || actor;
  if (!ids.length) {
    const admins = await User.find({ role:'superadmin', active:true }).select('_id').lean();
    return notifyUsers(admins.map(user=>user._id).filter(id => String(id) !== String(actorId || '')), {
      type: 'system',
      title: `${STAGE_LABELS[stage] || stage}: mas’ul topilmadi`,
      message: `${submission.applicationNo} navbatga keldi, ammo bu bosqich uchun faol mas’ul hisob yo‘q.`,
      link: `/submissions/${submission._id}`,
      submission: submission._id,
      createdBy: actorId
    });
  }
  return notifyUsers(ids.filter(id => String(id) !== String(actorId || '')), {
    type: 'submission',
    title: `${STAGE_LABELS[stage] || stage}: yangi ariza`,
    message,
    link: `/submissions/${submission._id}`,
    submission: submission._id,
    createdBy: actorId
  });
}

async function notifyApplicant(submission, actor, title, message, type = 'decision') {
  const actorId = actor?._id || actor;
  if (!submission.applicant || String(submission.applicant) === String(actorId || '')) return [];
  return notifyUsers([submission.applicant], {
    type,
    title,
    message,
    link: `/submissions/${submission._id}`,
    submission: submission._id,
    createdBy: actorId
  });
}

module.exports = { recipientsForStage, notifyUsers, notifyStage, notifyApplicant };
