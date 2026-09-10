const Student = require('../models/Student');
const User = require('../models/User');
const Upload = require('../models/Upload');
const MonitoringItem = require('../models/MonitoringItem');
const Task = require('../models/Task');
const Seminar = require('../models/Seminar');
const ScientificActivity = require('../models/ScientificActivity');
const DocumentRecord = require('../models/DocumentRecord');
const AuditLog = require('../models/AuditLog');
const ResearchSubmission = require('../models/ResearchSubmission');
const { scopeQueryForUser } = require('../middleware/auth');
const { SUBMISSION_TYPES, STATUS_LABELS, STATUS_TONES } = require('../config/submissionWorkflow');

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
    course1: list.filter(x => Number(x.course) === 1).length,
    course2: list.filter(x => Number(x.course) === 2).length,
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

async function buildStudentOverview(user, selectedGroup = '') {
  const base = selectedGroup ? { group: selectedGroup } : {};
  const students = await Student.find(scopeQueryForUser(user, base))
    .select('group course studyStatus status attendance individualPlan dissertationProgress scientificActivity academicScore documentsCompleteness graduationReadiness')
    .lean();
  const status = {
    green: students.filter(s => s.status === 'green').length,
    yellow: students.filter(s => s.status === 'yellow').length,
    red: students.filter(s => s.status === 'red').length
  };
  const groupStats = groupStudentMetrics(students.filter(s => s.group), 'group');
  return {
    total: students.length,
    course1: students.filter(s => Number(s.course) === 1).length,
    course2: students.filter(s => Number(s.course) === 2).length,
    groupCount: new Set(students.map(s => s.group).filter(Boolean)).size,
    active: students.filter(s => s.studyStatus === 'active').length,
    status,
    averages: {
      attendance: avg(students, 'attendance'),
      plan: avg(students, 'individualPlan'),
      dissertation: avg(students, 'dissertationProgress'),
      science: avg(students, 'scientificActivity'),
      readiness: avg(students, 'graduationReadiness')
    },
    groupStats,
    updatedAt: new Date().toISOString()
  };
}

async function idsAndScope(user) {
  const query = scopeQueryForUser(user, {});
  const students = await Student.find(query).populate('supervisor','fullName faculty department avatarPath role').populate('user','fullName role avatarPath faculty department').lean();
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
  const communityUserFilter = user.role === 'dean' && user.faculty ? { faculty:user.faculty, active:true }
    : ['department','supervisor','teacher'].includes(user.role) && user.department ? { department:user.department, active:true }
    : user.role === 'student' && (students[0]?.department || user.department) ? { department:students[0]?.department || user.department, active:true }
    : user.role === 'student' && (students[0]?.faculty || user.faculty) ? { faculty:students[0]?.faculty || user.faculty, active:true }
    : user.role === 'student' ? { _id:user._id, active:true }
    : { active:true };
  let submissionFilter = {};
  if (user.role === 'student') submissionFilter = { student: { $in: ids } };
  else if (user.role === 'supervisor') submissionFilter = { supervisor: user._id };
  else if (user.role === 'dean') submissionFilter = user.faculty ? { faculty: user.faculty } : { _id: null };
  else if (['department','teacher'].includes(user.role)) submissionFilter = user.department ? { department: user.department } : { _id: null };
  let taskFilter = Object.keys(orgFilter).length ? orgFilter : {};
  if (user.role === 'student') taskFilter = { student: { $in: ids } };
  else if (user.role === 'supervisor') taskFilter = { $or: [{ student: { $in: ids } }, { assignedTo: user._id }] };
  else if (user.role === 'teacher') taskFilter = { department: user.department };
  else if (!['dean','department'].includes(user.role)) taskFilter = {};

  const [monitorItems, tasks, seminars, science, documents, uploadCount, userCount, activeUsers, auditToday, communityUsers, communityRoleRows] = await Promise.all([
    MonitoringItem.find({ student: { $in: ids } }).sort({ updatedAt: -1 }).limit(200).lean(),
    Task.find(taskFilter).populate('student','fullName group').populate('assignedTo','fullName role avatarPath').sort({ createdAt: -1 }).limit(200).lean(),
    Seminar.find(orgFilter).populate('responsible','fullName avatarPath role').sort({ date: -1 }).limit(150).lean(),
    ScientificActivity.find({ student: { $in: ids } }).populate('student','fullName group').sort({ date: -1, createdAt: -1 }).limit(250).lean(),
    DocumentRecord.find({ student: { $in: ids } }).populate('student','fullName group').sort({ updatedAt: -1 }).limit(300).lean(),
    Upload.countDocuments(['student','supervisor','teacher'].includes(user.role) ? { student: { $in: ids } } : orgFilter),
    User.countDocuments(user.role === 'dean' ? { faculty: user.faculty } : user.role === 'department' ? { department: user.department } : {}),
    User.countDocuments({ ...(user.role === 'dean' ? { faculty: user.faculty } : user.role === 'department' ? { department: user.department } : {}), active: true }),
    AuditLog.countDocuments({ createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }),
    User.find(communityUserFilter).select('fullName role faculty department avatarPath bio active').sort({ lastLoginAt:-1, fullName:1 }).limit(10).lean(),
    User.aggregate([
      { $match: communityUserFilter },
      { $group: { _id:'$role', count:{ $sum:1 }, withPhoto:{ $sum:{ $cond:[{ $and:[{ $ne:['$avatarPath',''] },{ $ne:['$avatarPath',null] }] },1,0] } } } }
    ])
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

  let submissionPendingFilter;
  if (user.role === 'student') submissionPendingFilter = { status:'changes_requested' };
  else if (['supervisor','department','dean','magistracy','management'].includes(user.role)) submissionPendingFilter = { status:'under_review', currentStage:user.role };
  else submissionPendingFilter = { status:'under_review' };
  const scopedSubmissionQuery = extra => Object.keys(submissionFilter).length ? { $and:[submissionFilter,extra] } : extra;
  const [submissionRecent,submissionTotal,submissionPending,submissionApproved,submissionReviewing] = await Promise.all([
    ResearchSubmission.find(submissionFilter).populate('student','fullName group').sort({lastActionAt:-1}).limit(8).lean(),
    ResearchSubmission.countDocuments(submissionFilter),
    ResearchSubmission.countDocuments(scopedSubmissionQuery(submissionPendingFilter)),
    ResearchSubmission.countDocuments(scopedSubmissionQuery({status:'approved'})),
    ResearchSubmission.countDocuments(scopedSubmissionQuery({status:'under_review'}))
  ]);
  const submissionStats = { total:submissionTotal, pending:submissionPending, approved:submissionApproved, reviewing:submissionReviewing };

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

  const roleCounts = communityRoleRows.reduce((acc, row) => {
    acc[row._id] = Number(row.count || 0);
    return acc;
  }, {});
  const networkStats = {
    people: communityRoleRows.reduce((n,row) => n + Number(row.count || 0), 0),
    students: roleCounts.student || 0,
    supervisors: roleCounts.supervisor || 0,
    teachers: roleCounts.teacher || 0,
    managers: (roleCounts.magistracy || 0) + (roleCounts.dean || 0) + (roleCounts.department || 0),
    withPhoto: communityRoleRows.reduce((n,row) => n + Number(row.withPhoto || 0), 0),
    groups: new Set(students.map(row => row.group).filter(Boolean)).size,
    departments: new Set(students.map(row => row.department).filter(Boolean)).size,
    faculties: new Set(students.map(row => row.faculty).filter(Boolean)).size
  };
  const communityProfiles = communityUsers
    .filter(row => String(row._id) !== String(user._id))
    .slice(0, 10);

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
    lowProfiles: students.filter(s => Number(s.profileCompleteness || 0) < 50).length
  };

  return {
    students, kpis, status, dissertationBuckets, attendanceBuckets,
    problems, tasks, openTasks, overdueTasks, upcomingTasks,
    seminars, seminarStats, science, scienceStats, documents, docStats,
    monitorItems, missingDocs, updateDocs, supervisorStats,
    facultyStats: groupStudentMetrics(students,'faculty'),
    departmentStats: groupStudentMetrics(students,'department'),
    specialtyStats: groupStudentMetrics(students,'specialty'),
    courseStats: groupStudentMetrics(students,'course'),
    groupStats: groupStudentMetrics(students.filter(s => s.group),'group'),
    percentages: { green: pct(status.green,total), yellow: pct(status.yellow,total), red: pct(status.red,total) },
    statusName,
    submissionStats,
    submissionRecent,
    submissionTypeLabels:SUBMISSION_TYPES,
    submissionStatusLabels:STATUS_LABELS,
    submissionStatusTones:STATUS_TONES,
    networkStats,
    communityProfiles
  };
}

module.exports = { buildDashboardData, buildStudentOverview, groupStudentMetrics, avg, statusName };
