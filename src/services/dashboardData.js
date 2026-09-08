const Student = require('../models/Student');
const User = require('../models/User');
const Upload = require('../models/Upload');
const MonitoringItem = require('../models/MonitoringItem');
const Task = require('../models/Task');
const Seminar = require('../models/Seminar');
const ScientificActivity = require('../models/ScientificActivity');
const DocumentRecord = require('../models/DocumentRecord');
const AuditLog = require('../models/AuditLog');
const SubmissionApplication = require('../models/SubmissionApplication');
const { visibilityFilterForUser, pendingFilterForUser } = require('./submissionWorkflow');
const { scopeQueryForUser } = require('../middleware/auth');

const avg = (rows, key) => rows.length ? Math.round(rows.reduce((n, r) => n + Number(r[key] || 0), 0) / rows.length) : 0;
const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
const statusName = p => p >= 80 ? 'green' : p >= 60 ? 'yellow' : 'red';

function groupStudentMetrics(rows, field) {
  const map = new Map();
  rows.forEach(s => {
    const raw = s[field];
    const name = raw === undefined || raw === null || raw === '' ? 'Ko‘rsatilmagan' : String(raw);
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(s);
  });
  return [...map.entries()].map(([name, list]) => ({
    name,
    total: list.length,
    attendance: avg(list, 'attendance'),
    plan: avg(list, 'individualPlan'),
    dissertation: avg(list, 'dissertationProgress'),
    science: avg(list, 'scientificActivity'),
    academic: avg(list, 'academicScore'),
    documents: avg(list, 'documentsCompleteness'),
    readiness: avg(list, 'graduationReadiness'),
    red: list.filter(x => x.status === 'red').length
  })).sort((a,b) => b.total - a.total || a.name.localeCompare(b.name));
}

async function idsAndScope(user) {
  const query = scopeQueryForUser(user, {});
  const students = await Student.find(query).populate('supervisor','fullName faculty department').lean();
  return { students, ids: students.map(s => s._id), query };
}

async function buildDashboardData(user) {
  const { students, ids } = await idsAndScope(user);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const facultyFilter = user.role === 'dean' ? { faculty: user.faculty } : {};
  const departmentFilter = ['department','teacher','supervisor'].includes(user.role) && user.department ? { department: user.department } : {};
  const studentFilter = user.role === 'student' && students[0] ? (students[0].department ? { department: students[0].department } : students[0].faculty ? { faculty: students[0].faculty } : { _id: null }) : {};
  const orgFilter = { ...facultyFilter, ...departmentFilter, ...studentFilter };
  const submissionVisibility = visibilityFilterForUser(user);
  const submissionPendingFilter = pendingFilterForUser(user);
  let taskFilter = Object.keys(orgFilter).length ? orgFilter : {};
  if (user.role === 'student') taskFilter = { student: { $in: ids } };
  else if (user.role === 'supervisor') taskFilter = { $or: [{ student: { $in: ids } }, { assignedTo: user._id }] };
  else if (user.role === 'teacher') taskFilter = { department: user.department };
  else if (!['dean','department'].includes(user.role)) taskFilter = {};

  const [monitorItems, tasks, seminars, science, documents, uploadCount, userCount, activeUsers, auditToday, submissions, submissionPendingCount] = await Promise.all([
    MonitoringItem.find({ student: { $in: ids } }).sort({ updatedAt: -1 }).limit(200).lean(),
    Task.find(taskFilter).populate('student','fullName group').populate('assignedTo','fullName role').sort({ createdAt: -1 }).limit(200).lean(),
    Seminar.find(orgFilter).populate('responsible','fullName').sort({ date: -1 }).limit(150).lean(),
    ScientificActivity.find({ student: { $in: ids } }).populate('student','fullName group').sort({ date: -1, createdAt: -1 }).limit(250).lean(),
    DocumentRecord.find({ student: { $in: ids } }).populate('student','fullName group').sort({ updatedAt: -1 }).limit(300).lean(),
    Upload.countDocuments(['student','supervisor','teacher'].includes(user.role) ? { student: { $in: ids } } : orgFilter),
    User.countDocuments(user.role === 'dean' ? { faculty: user.faculty } : user.role === 'department' ? { department: user.department } : {}),
    User.countDocuments({ ...(user.role === 'dean' ? { faculty: user.faculty } : user.role === 'department' ? { department: user.department } : {}), active: true }),
    AuditLog.countDocuments({ createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }),
    SubmissionApplication.find(submissionVisibility).populate('student','fullName group').sort({ updatedAt: -1 }).limit(120).lean(),
    SubmissionApplication.countDocuments(submissionPendingFilter)
  ]);

  const total = students.length;
  const status = {
    green: students.filter(s => s.status === 'green').length,
    yellow: students.filter(s => s.status === 'yellow').length,
    red: students.filter(s => s.status === 'red').length
  };

  const dissertationBuckets = {
    complete: students.filter(s => s.dissertationProgress === 100).length,
    high: students.filter(s => s.dissertationProgress >= 75 && s.dissertationProgress < 100).length,
    medium: students.filter(s => s.dissertationProgress >= 50 && s.dissertationProgress < 75).length,
    low: students.filter(s => s.dissertationProgress < 50).length
  };

  const attendanceBuckets = {
    good: students.filter(s => s.attendance >= 90).length,
    watch: students.filter(s => s.attendance >= 75 && s.attendance < 90).length,
    problem: students.filter(s => s.attendance < 75).length
  };

  const problems = students.filter(s =>
    s.status === 'red' || s.attendance < 75 || s.individualPlan < 60 ||
    s.dissertationProgress < 60 || s.documentsCompleteness < 60 || Number(s.academicDebtCount || 0) > 0
  ).sort((a,b) => (a.attendance + a.individualPlan + a.dissertationProgress) - (b.attendance + b.individualPlan + b.dissertationProgress));

  const missingDocs = documents.filter(d => d.status === 'missing');
  const updateDocs = documents.filter(d => d.status === 'update');
  const openTasks = tasks.filter(t => !['resolved','cancelled'].includes(t.status));
  const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
  const upcomingTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= in30).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

  const seminarStats = {
    planned: seminars.filter(s => s.status === 'planned').length,
    held: seminars.filter(s => s.status === 'held').length,
    cancelled: seminars.filter(s => s.status === 'cancelled').length,
    minutes: seminars.filter(s => s.minutesUploaded).length,
    materials: seminars.filter(s => s.materialsUploaded).length
  };

  const scienceStats = {
    publications: science.filter(x => x.type === 'publication').length,
    conferences: science.filter(x => x.type === 'conference').length,
    research: science.filter(x => x.type === 'research').length,
    seminars: science.filter(x => x.type === 'seminar').length,
    accepted: science.filter(x => ['accepted','published','completed'].includes(x.status)).length
  };

  const docStats = {
    present: documents.filter(d => d.status === 'present').length,
    update: updateDocs.length,
    missing: missingDocs.length
  };

  const submissionStats = {
    total: submissions.length,
    pending: submissionPendingCount,
    inReview: submissions.filter(x => x.status === 'in_review').length,
    needsRevision: submissions.filter(x => x.status === 'needs_revision').length,
    approved: submissions.filter(x => x.status === 'approved').length,
    rejected: submissions.filter(x => x.status === 'rejected').length,
    supervisor: submissions.filter(x => x.currentStage === 'supervisor' && x.status === 'in_review').length,
    department: submissions.filter(x => x.currentStage === 'department' && x.status === 'in_review').length,
    dean: submissions.filter(x => x.currentStage === 'dean' && x.status === 'in_review').length,
    magistracy: submissions.filter(x => x.currentStage === 'magistracy' && x.status === 'in_review').length,
    management: submissions.filter(x => x.currentStage === 'management' && x.status === 'in_review').length
  };

  const supervisorMap = new Map();
  students.forEach(s => {
    const id = String(s.supervisor?._id || 'none');
    const name = s.supervisor?.fullName || 'Biriktirilmagan';
    if (!supervisorMap.has(id)) supervisorMap.set(id, { name, students: [] });
    supervisorMap.get(id).students.push(s);
  });
  const supervisorStats = [...supervisorMap.values()].map(x => ({
    name: x.name,
    total: x.students.length,
    attendance: avg(x.students,'attendance'),
    dissertation: avg(x.students,'dissertationProgress'),
    plan: avg(x.students,'individualPlan'),
    red: x.students.filter(s => s.status === 'red').length
  })).sort((a,b) => b.total - a.total);

  const kpis = {
    total,
    course1: students.filter(s => s.course === 1).length,
    course2: students.filter(s => s.course === 2).length,
    specialties: new Set(students.map(s => s.specialty).filter(Boolean)).size,
    supervisors: new Set(students.map(s => String(s.supervisor?._id || '')).filter(Boolean)).size,
    attendance: avg(students,'attendance'),
    plan: avg(students,'individualPlan'),
    dissertation: avg(students,'dissertationProgress'),
    science: avg(students,'scientificActivity'),
    academic: avg(students,'academicScore'),
    documents: avg(students,'documentsCompleteness'),
    readiness: avg(students,'graduationReadiness'),
    profileCompleteness: avg(students,'profileCompleteness'),
    academicDebt: students.reduce((n,s) => n + Number(s.academicDebtCount || 0), 0),
    problemStudents: problems.length,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    uploads: uploadCount,
    users: userCount,
    activeUsers,
    auditToday,
    monitorRecords: monitorItems.length,
    publications: scienceStats.publications,
    conferences: scienceStats.conferences,
    seminarsHeld: seminarStats.held,
    missingDocs: missingDocs.length,
    lowProfiles: students.filter(s => Number(s.profileCompleteness || 0) < 50).length,
    submissions: submissionStats.total,
    submissionPending: submissionStats.pending,
    submissionApproved: submissionStats.approved,
    submissionRevision: submissionStats.needsRevision
  };

  return {
    students, kpis, status, dissertationBuckets, attendanceBuckets,
    problems, tasks, openTasks, overdueTasks, upcomingTasks,
    seminars, seminarStats, science, scienceStats, documents, docStats,
    monitorItems, missingDocs, updateDocs, supervisorStats, submissions, submissionStats,
    facultyStats: groupStudentMetrics(students,'faculty'),
    departmentStats: groupStudentMetrics(students,'department'),
    specialtyStats: groupStudentMetrics(students,'specialty'),
    courseStats: groupStudentMetrics(students,'course'),
    percentages: { green: pct(status.green,total), yellow: pct(status.yellow,total), red: pct(status.red,total) },
    statusName
  };
}

module.exports = { buildDashboardData, groupStudentMetrics, avg, statusName };
