const WORKFLOW_STAGES = ['supervisor', 'department', 'dean', 'magistracy', 'management'];

const STAGE_LABELS = {
  student: 'Magistrant',
  supervisor: 'Ilmiy rahbar',
  department: 'Kafedra mudiri',
  dean: 'Dekanat / fakultet',
  magistracy: 'Magistratura bo‘limi',
  management: 'Rahbariyat',
  completed: 'Yakunlangan'
};

const SUBMISSION_TYPES = {
  dissertation_chapter: 'Dissertatsiya bobi',
  article: 'Ilmiy maqola',
  thesis: 'Tezis',
  conference_material: 'Konferensiya materiali',
  research_report: 'Ilmiy-tadqiqot hisoboti',
  individual_plan: 'Individual reja / ijro',
  seminar_material: 'Ilmiy seminar materiali',
  attestation_document: 'Attestatsiya hujjati',
  defense_document: 'Himoya hujjati',
  source: 'Source / manba material',
  other: 'Boshqa ilmiy material'
};

const STATUS_LABELS = {
  draft: 'Qoralama',
  under_review: 'Ko‘rib chiqilmoqda',
  changes_requested: 'Tuzatishga qaytarilgan',
  rejected: 'Rad etilgan',
  approved: 'To‘liq tasdiqlangan',
  withdrawn: 'Talaba qaytarib olgan',
  archived: 'Arxivlangan'
};

const STATUS_TONES = {
  draft: 'muted',
  under_review: 'yellow',
  changes_requested: 'orange',
  rejected: 'red',
  approved: 'green',
  withdrawn: 'muted',
  archived: 'muted'
};

const ACTION_LABELS = {
  created: 'Qoralama yaratildi',
  edited: 'Ariza tahrirlandi',
  submitted: 'Ko‘rib chiqishga yuborildi',
  resubmitted: 'Tuzatilib qayta yuborildi',
  approved: 'Ma’qullandi',
  changes_requested: 'Tuzatishga qaytarildi',
  rejected: 'Rad etildi',
  commented: 'Sharh yozildi',
  withdrawn: 'Talaba arizani qaytarib oldi',
  reopened: 'Ariza qayta ochildi',
  rerouted: 'Bosqich o‘zgartirildi',
  archived: 'Arxivlandi',
  supervisor_reassigned: 'Ilmiy rahbar qayta biriktirildi',
  attachment_added: 'Fayl qo‘shildi',
  attachment_removed: 'Fayl olib tashlandi'
};

function nextStage(stage) {
  const index = WORKFLOW_STAGES.indexOf(stage);
  return index >= 0 && index < WORKFLOW_STAGES.length - 1 ? WORKFLOW_STAGES[index + 1] : null;
}

function buildStageProgress(supervisorId) {
  return WORKFLOW_STAGES.map(stage => ({
    stage,
    status: 'waiting',
    assignedTo: stage === 'supervisor' ? supervisorId : undefined
  }));
}

function canReview(user, submission) {
  if (!user || !submission || submission.status !== 'under_review') return false;
  const stage = submission.currentStage;
  if (!WORKFLOW_STAGES.includes(stage)) return false;
  if (user.role === 'superadmin') return true;
  if (stage === 'supervisor') {
    if (!['supervisor', 'teacher'].includes(user.role)) return false;
    return String(submission.supervisor?._id || submission.supervisor || '') === String(user._id || '');
  }
  if (user.role !== stage) return false;
  if (stage === 'department') return !!user.department && submission.department === user.department;
  if (stage === 'dean') return !!user.faculty && submission.faculty === user.faculty;
  return stage === 'magistracy' || stage === 'management';
}

module.exports = {
  WORKFLOW_STAGES,
  STAGE_LABELS,
  SUBMISSION_TYPES,
  STATUS_LABELS,
  STATUS_TONES,
  ACTION_LABELS,
  nextStage,
  buildStageProgress,
  canReview
};
