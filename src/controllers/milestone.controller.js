const Student = require('../models/Student');
const DissertationMilestone = require('../models/DissertationMilestone');
const { scopeQueryForUser } = require('../middleware/auth');
const audit = require('../services/audit');
const DISSERTATION_STAGES = require('../utils/dissertationStages');

exports.index = async (req, res, next) => {
  try {
    const students = await Student.find(scopeQueryForUser(req.user, {})).populate('supervisor','fullName').sort({ group:1, fullName:1 }).lean();
    const selectedId = String(req.query.student || (req.user.role === 'student' ? students[0]?._id || '' : '')).trim();
    const selected = students.find(s => String(s._id) === selectedId) || students[0] || null;
    const milestones = selected ? await DissertationMilestone.find({ student: selected._id }).sort({ stage:1 }).lean() : [];
    const byStage = new Map(milestones.map(m => [m.stage, m]));
    const timeline = DISSERTATION_STAGES.map((title, i) => ({ stage:i+1, title, record:byStage.get(i+1) || null }));
    res.render('milestones/index', { title:'Dissertatsiya bosqichlari', students, selected, timeline });
  } catch (e) { next(e); }
};

exports.save = async (req, res, next) => {
  try {
    const student = await Student.findOne(scopeQueryForUser(req.user, { _id:req.params.studentId }));
    if (!student) return res.status(404).render('errors/404', { title:'Magistrant topilmadi' });
    const stage = Math.max(1, Math.min(12, Number(req.params.stage || 1)));
    const title = DISSERTATION_STAGES[stage - 1] || `Bosqich ${stage}`;
    const payload = {
      title,
      status: ['not_started','in_progress','submitted','approved','delayed'].includes(req.body.status) ? req.body.status : 'in_progress',
      percent: Math.max(0, Math.min(100, Number(req.body.percent || 0))),
      dueDate: req.body.dueDate || null,
      evidenceLink: String(req.body.evidenceLink || '').trim(),
      note: String(req.body.note || '').trim(),
      updatedBy: req.user._id
    };
    if (payload.status === 'approved') payload.completedAt = new Date();
    const record = await DissertationMilestone.findOneAndUpdate({ student:student._id, stage }, { $set:payload }, { upsert:true, new:true, setDefaultsOnInsert:true });
    if (stage >= Number(student.dissertationStage || 1) && ['submitted','approved'].includes(payload.status)) student.dissertationStage = stage;
    const approved = await DissertationMilestone.find({ student:student._id, status:'approved' }).select('stage percent').lean();
    if (approved.length) student.dissertationProgress = Math.max(student.dissertationProgress || 0, Math.round((approved.length / 12) * 100));
    student.recalculateStatus();
    await student.save();
    await audit(req, 'milestone_update', 'DissertationMilestone', record._id, { student:String(student._id), stage, status:payload.status });
    req.session.flash = { type:'success', text:'Dissertatsiya bosqichi saqlandi.' };
    res.redirect(`/milestones?student=${student._id}`);
  } catch (e) { next(e); }
};
