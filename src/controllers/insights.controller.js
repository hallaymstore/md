const Student = require('../models/Student');
const User = require('../models/User');
const Task = require('../models/Task');
const ResearchSubmission = require('../models/ResearchSubmission');
const { scopeQueryForUser } = require('../middleware/auth');
const { buildRiskCards } = require('../services/riskEngine');

exports.risks = async (req, res, next) => {
  try {
    const students = await Student.find(scopeQueryForUser(req.user, {})).populate('supervisor','fullName').sort({ fullName: 1 }).lean();
    const cards = await buildRiskCards(students);
    const counts = {
      red: cards.filter(x => x.severity === 'red').length,
      yellow: cards.filter(x => x.severity === 'yellow').length,
      green: cards.filter(x => x.severity === 'green').length
    };
    res.render('insights/risks', { title: 'Erta ogohlantirish markazi', cards, counts });
  } catch (e) { next(e); }
};

exports.supervisors = async (req, res, next) => {
  try {
    const students = await Student.find(scopeQueryForUser(req.user, {})).populate('supervisor','fullName department faculty').lean();
    const ids = students.map(s => s._id);
    const [openTasks, pendingSubmissions] = await Promise.all([
      Task.find({ student: { $in: ids }, status: { $in: ['new','in_progress'] } }).select('student dueDate').lean(),
      ResearchSubmission.find({ student: { $in: ids }, status: 'under_review' }).select('student supervisor currentStage lastActionAt').lean()
    ]);
    const map = new Map();
    for (const s of students) {
      const key = String(s.supervisor?._id || 'none');
      if (!map.has(key)) map.set(key, { id: key, name: s.supervisor?.fullName || 'Biriktirilmagan', department: s.supervisor?.department || s.department || '—', students: [] });
      map.get(key).students.push(s);
    }
    const taskByStudent = new Map();
    openTasks.forEach(t => taskByStudent.set(String(t.student), (taskByStudent.get(String(t.student)) || 0) + 1));
    const subBySupervisor = new Map();
    pendingSubmissions.forEach(s => {
      const key = String(s.supervisor || 'none');
      subBySupervisor.set(key, (subBySupervisor.get(key) || 0) + 1);
    });
    const avg = (arr, key) => arr.length ? Math.round(arr.reduce((n, x) => n + Number(x[key] || 0), 0) / arr.length) : 0;
    const rows = [...map.values()].map(x => {
      const red = x.students.filter(s => s.status === 'red').length;
      const open = x.students.reduce((n, s) => n + (taskByStudent.get(String(s._id)) || 0), 0);
      const total = x.students.length;
      const loadTone = total >= 12 ? 'red' : total >= 8 ? 'yellow' : 'green';
      return {
        ...x, total, red, open,
        pending: subBySupervisor.get(x.id) || 0,
        attendance: avg(x.students, 'attendance'),
        plan: avg(x.students, 'individualPlan'),
        dissertation: avg(x.students, 'dissertationProgress'),
        science: avg(x.students, 'scientificActivity'),
        loadTone
      };
    }).sort((a,b) => b.total - a.total || b.red - a.red);
    res.render('insights/supervisors', { title: 'Ilmiy rahbar yuklamasi', rows });
  } catch (e) { next(e); }
};
