const Student = require('../models/Student');
const ScientificActivity = require('../models/ScientificActivity');
const Seminar = require('../models/Seminar');
const ResearchSubmission = require('../models/ResearchSubmission');

const avg = (rows, key) => rows.length
  ? Math.round(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length)
  : 0;

function groupStats(rows) {
  const map = new Map();
  rows.forEach(student => {
    const name = String(student.group || '').trim();
    if (!name) return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(student);
  });
  return [...map.entries()].map(([name, list]) => {
    const attendance = avg(list, 'attendance');
    const plan = avg(list, 'individualPlan');
    const dissertation = avg(list, 'dissertationProgress');
    const readiness = avg(list, 'graduationReadiness');
    const score = Math.round((attendance + plan + dissertation + readiness) / 4);
    return {
      name,
      total: list.length,
      course1: list.filter(x => Number(x.course) === 1).length,
      course2: list.filter(x => Number(x.course) === 2).length,
      attendance,
      dissertation,
      readiness,
      score,
      risk: list.filter(x => x.status === 'red').length
    };
  }).sort((a, b) => b.score - a.score || b.total - a.total || a.name.localeCompare(b.name, 'uz'));
}

async function buildPublicDisplayData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const studentRowsPromise = Student.find({ studyStatus: 'active' })
    .select('course group faculty department specialty supervisor status attendance individualPlan dissertationProgress scientificActivity graduationReadiness updatedAt')
    .lean();

  const [students, scienceRows, seminarRows, submissionRows] = await Promise.all([
    studentRowsPromise,
    ScientificActivity.aggregate([
      { $match: { status: { $in: ['accepted', 'published', 'completed'] } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    Seminar.aggregate([
      { $match: { date: { $gte: monthStart } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    ResearchSubmission.aggregate([
      { $match: { status: { $in: ['approved', 'under_review', 'changes_requested'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const countMap = rows => rows.reduce((acc, row) => {
    acc[row._id] = Number(row.count || 0);
    return acc;
  }, {});
  const science = countMap(scienceRows);
  const seminars = countMap(seminarRows);
  const submissions = countMap(submissionRows);
  const total = students.length;
  const statuses = {
    green: students.filter(x => x.status === 'green').length,
    yellow: students.filter(x => x.status === 'yellow').length,
    red: students.filter(x => x.status === 'red').length
  };

  const averages = {
    attendance: avg(students, 'attendance'),
    plan: avg(students, 'individualPlan'),
    dissertation: avg(students, 'dissertationProgress'),
    science: avg(students, 'scientificActivity'),
    readiness: avg(students, 'graduationReadiness')
  };

  const groups = groupStats(students);
  const latestStudentUpdate = students.reduce((latest, row) => {
    const value = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return value > latest ? value : latest;
  }, 0);

  return {
    total,
    course1: students.filter(x => Number(x.course) === 1).length,
    course2: students.filter(x => Number(x.course) === 2).length,
    groups: groups.length,
    specialties: new Set(students.map(x => x.specialty).filter(Boolean)).size,
    departments: new Set(students.map(x => x.department).filter(Boolean)).size,
    faculties: new Set(students.map(x => x.faculty).filter(Boolean)).size,
    supervisors: new Set(students.map(x => String(x.supervisor || '')).filter(Boolean)).size,
    statuses,
    averages,
    science: {
      publications: science.publication || 0,
      conferences: science.conference || 0,
      research: science.research || 0,
      seminars: science.seminar || 0,
      total: Object.values(science).reduce((sum, n) => sum + n, 0)
    },
    seminars: {
      held: seminars.held || 0,
      planned: seminars.planned || 0
    },
    workflow: {
      approved: submissions.approved || 0,
      reviewing: submissions.under_review || 0,
      revisions: submissions.changes_requested || 0
    },
    groupStats: groups.slice(0, 8),
    latestDataAt: latestStudentUpdate ? new Date(latestStudentUpdate).toISOString() : null,
    updatedAt: new Date().toISOString()
  };
}

module.exports = { buildPublicDisplayData };
