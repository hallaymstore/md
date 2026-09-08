const SubmissionApplication = require('../models/SubmissionApplication');

const NORMAL_FLOW = ['supervisor', 'department', 'dean', 'magistracy'];
const HIGH_FLOW = ['supervisor', 'department', 'dean', 'magistracy', 'management'];
const HIGH_TYPES = new Set(['dissertation', 'thesis', 'defense']);

const STAGE_LABELS = {
  student: 'Magistrant',
  supervisor: 'Ilmiy rahbar',
  department: 'Kafedra mudiri',
  dean: 'Dekanat / fakultet',
  magistracy: 'Magistratura bo‘limi',
  management: 'Universitet rahbariyati',
  completed: 'Yakunlangan'
};

const TYPE_LABELS = {
  publication: 'Ilmiy maqola',
  conference: 'Konferensiya materiali',
  research: 'Ilmiy tadqiqot',
  seminar: 'Ilmiy seminar materiali',
  dissertation: 'Dissertatsiya materiali',
  thesis: 'Tezis',
  defense: 'Himoya materiali',
  report: 'Ilmiy hisobot',
  source: 'Source / manba',
  document: 'Ilmiy hujjat',
  other: 'Boshqa ilmiy material'
};

const STATUS_LABELS = {
  in_review: 'Ko‘rib chiqilmoqda',
  needs_revision: 'Qayta ishlash kerak',
  rejected: 'Rad etilgan',
  approved: 'Yakuniy ma’qullangan'
};

function flowForType(type) {
  return HIGH_TYPES.has(type) ? [...HIGH_FLOW] : [...NORMAL_FLOW];
}

function nextStage(type, currentStage) {
  const flow = flowForType(type);
  const idx = flow.indexOf(currentStage);
  if (idx < 0) return null;
  return flow[idx + 1] || 'completed';
}

function previousStage(type, currentStage) {
  const flow = flowForType(type);
  const idx = flow.indexOf(currentStage);
  if (idx <= 0) return null;
  return flow[idx - 1];
}

function visibilityFilterForUser(user) {
  if (!user) return { _id: null };
  if (['superadmin', 'tech', 'magistracy'].includes(user.role)) return {};
  if (user.role === 'management') return {};
  if (user.role === 'dean') return { faculty: user.faculty || '__none__' };
  if (user.role === 'department') return { department: user.department || '__none__' };
  if (user.role === 'supervisor') return { supervisor: user._id };
  if (user.role === 'student') return { createdBy: user._id };
  return { _id: null };
}

function pendingFilterForUser(user) {
  if (!user) return { _id: null };
  if (user.role === 'student') return { createdBy: user._id, status: 'needs_revision' };
  if (user.role === 'supervisor') return { supervisor: user._id, currentStage: 'supervisor', status: 'in_review' };
  if (user.role === 'department') return { department: user.department || '__none__', currentStage: 'department', status: 'in_review' };
  if (user.role === 'dean') return { faculty: user.faculty || '__none__', currentStage: 'dean', status: 'in_review' };
  if (user.role === 'magistracy') return { currentStage: 'magistracy', status: 'in_review' };
  if (user.role === 'management') return { currentStage: 'management', status: 'in_review' };
  if (['superadmin', 'tech'].includes(user.role)) return { status: 'in_review' };
  return { _id: null };
}

function canView(user, item) {
  if (!user || !item) return false;
  if (['superadmin', 'tech', 'magistracy', 'management'].includes(user.role)) return true;
  if (user.role === 'dean') return !!user.faculty && item.faculty === user.faculty;
  if (user.role === 'department') return !!user.department && item.department === user.department;
  if (user.role === 'supervisor') return String(item.supervisor || '') === String(user._id);
  if (user.role === 'student') return String(item.createdBy || '') === String(user._id);
  return false;
}

function canReview(user, item) {
  if (!user || !item || item.status !== 'in_review') return false;
  if (user.role === 'superadmin') return true;
  if (user.role !== item.currentStage) return false;
  if (user.role === 'supervisor') return String(item.supervisor || '') === String(user._id);
  if (user.role === 'department') return !!user.department && item.department === user.department;
  if (user.role === 'dean') return !!user.faculty && item.faculty === user.faculty;
  return ['magistracy', 'management'].includes(user.role);
}

function canComment(user, item) {
  if (!canView(user, item)) return false;
  return ['superadmin', 'tech', 'management', 'magistracy', 'dean', 'department', 'supervisor', 'student'].includes(user.role);
}

async function pendingCountForUser(user) {
  try {
    if (!user || user.role === 'teacher') return 0;
    return await SubmissionApplication.countDocuments(pendingFilterForUser(user));
  } catch (_) {
    return 0;
  }
}

module.exports = {
  NORMAL_FLOW,
  HIGH_FLOW,
  STAGE_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  flowForType,
  nextStage,
  previousStage,
  visibilityFilterForUser,
  pendingFilterForUser,
  canView,
  canReview,
  canComment,
  pendingCountForUser
};
