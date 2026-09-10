const Task = require('../models/Task');
const ResearchSubmission = require('../models/ResearchSubmission');
const ScientificActivity = require('../models/ScientificActivity');

function add(reasons, points, key, label, value) {
  reasons.push({ key, label, value, points });
  return points;
}

function expectedDissertation(course) {
  return Number(course) >= 2 ? 65 : 25;
}

async function buildRiskCards(students) {
  const ids = students.map(s => s._id);
  const now = new Date();
  const staleSubmission = new Date(now.getTime() - 10 * 86400000);
  const staleScience = new Date(now.getTime() - 120 * 86400000);

  const [tasks, submissions, science] = await Promise.all([
    Task.find({ student: { $in: ids }, status: { $in: ['new','in_progress'] } }).select('student dueDate priority status').lean(),
    ResearchSubmission.find({ student: { $in: ids }, status: 'under_review' }).select('student lastActionAt currentStage').lean(),
    ScientificActivity.find({ student: { $in: ids }, status: { $in: ['accepted','published','completed'] } }).select('student date createdAt').sort({ date: -1, createdAt: -1 }).lean()
  ]);

  const taskMap = new Map();
  tasks.forEach(t => {
    const k = String(t.student || '');
    const arr = taskMap.get(k) || [];
    arr.push(t); taskMap.set(k, arr);
  });
  const submissionMap = new Map();
  submissions.forEach(s => {
    const k = String(s.student || '');
    const arr = submissionMap.get(k) || [];
    arr.push(s); submissionMap.set(k, arr);
  });
  const scienceMap = new Map();
  science.forEach(s => {
    const k = String(s.student || '');
    if (!scienceMap.has(k)) scienceMap.set(k, s.date || s.createdAt);
  });

  return students.map(student => {
    const reasons = [];
    let score = 0;
    if (student.attendance < 65) score += add(reasons, 28, 'attendance_critical', 'Davomat kritik', `${student.attendance}%`);
    else if (student.attendance < 80) score += add(reasons, 16, 'attendance_watch', 'Davomat pasaygan', `${student.attendance}%`);

    if (student.individualPlan < 50) score += add(reasons, 22, 'plan_critical', 'Individual reja keskin ortda', `${student.individualPlan}%`);
    else if (student.individualPlan < 70) score += add(reasons, 12, 'plan_watch', 'Individual reja nazoratda', `${student.individualPlan}%`);

    const expected = expectedDissertation(student.course);
    if (student.dissertationProgress + 20 < expected) score += add(reasons, 22, 'dissertation_critical', 'Dissertatsiya kursga nisbatan ortda', `${student.dissertationProgress}% / kutilgan ~${expected}%`);
    else if (student.dissertationProgress < expected) score += add(reasons, 10, 'dissertation_watch', 'Dissertatsiya progressi past', `${student.dissertationProgress}%`);

    if (Number(student.academicDebtCount || 0) >= 2) score += add(reasons, 18, 'debt', 'Akademik qarzdorlik', `${student.academicDebtCount} ta`);
    else if (Number(student.academicDebtCount || 0) === 1) score += add(reasons, 8, 'debt_one', 'Akademik qarz mavjud', '1 ta');

    if (student.documentsCompleteness < 60) score += add(reasons, 12, 'documents', 'Hujjatlar to‘liq emas', `${student.documentsCompleteness}%`);
    if (!student.supervisor) score += add(reasons, 20, 'no_supervisor', 'Ilmiy rahbar biriktirilmagan', '—');
    if (!student.dissertationTitle) score += add(reasons, 8, 'no_topic', 'Dissertatsiya mavzusi kiritilmagan', '—');

    const studentTasks = taskMap.get(String(student._id)) || [];
    const overdue = studentTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    if (overdue.length) score += add(reasons, Math.min(18, 6 + overdue.length * 3), 'overdue_tasks', 'Muddati o‘tgan topshiriqlar', `${overdue.length} ta`);

    const stuck = (submissionMap.get(String(student._id)) || []).filter(s => s.lastActionAt && new Date(s.lastActionAt) < staleSubmission);
    if (stuck.length) score += add(reasons, 10, 'stuck_submission', 'Approval navbatida uzoq qolgan', `${stuck.length} ta`);

    const lastScience = scienceMap.get(String(student._id));
    if (Number(student.course) >= 2 && (!lastScience || new Date(lastScience) < staleScience)) {
      score += add(reasons, 8, 'science_stale', 'So‘nggi tasdiqlangan ilmiy natija eski', lastScience ? new Date(lastScience).toLocaleDateString('uz-UZ') : 'yo‘q');
    }

    score = Math.min(100, score);
    const severity = score >= 65 ? 'red' : score >= 30 ? 'yellow' : 'green';
    return { student, score, severity, reasons, overdue: overdue.length, stuck: stuck.length, lastScience };
  }).sort((a, b) => b.score - a.score);
}

module.exports = { buildRiskCards };
