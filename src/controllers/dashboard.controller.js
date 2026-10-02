const Student = require('../models/Student');
const User = require('../models/User');
const ScientificActivity = require('../models/ScientificActivity');
const ResearchSubmission = require('../models/ResearchSubmission');
const { scopeQueryForUser } = require('../middleware/auth');
const { SUBMISSION_TYPES } = require('../config/submissionWorkflow');
const { buildDashboardData, buildStudentOverview, groupStudentMetrics } = require('../services/dashboardData');
const { captureSnapshots } = require('../services/progressSnapshots');

const SCIENCE_TYPE_LABELS = {
  publication: 'Ilmiy maqola',
  conference: 'Konferensiya',
  research: 'Tadqiqot',
  seminar: 'Ilmiy seminar'
};

const ROLE_VIEW = {
  superadmin: 'system',
  tech: 'tech',
  management: 'management',
  magistracy: 'magistracy',
  dean: 'dean',
  department: 'department',
  supervisor: 'supervisor',
  teacher: 'teacher',
  student: 'student'
};

exports.index = async (req, res, next) => {
  try {
    const data = await buildDashboardData(req.user);
    captureSnapshots(data.students).catch(() => {});
    res.render('dashboard/index', {
      title: 'Boshqaruv paneli',
      dashboardView: `roles/${ROLE_VIEW[req.user.role] || 'student'}`,
      ...data
    });
  } catch (e) { next(e); }
};

exports.group = async (req, res, next) => {
  try {
    const groupName = String(req.params.group || '').trim().slice(0, 120);
    if (!groupName) return res.status(404).render('errors/404', { title: 'Guruh topilmadi' });

    const students = await Student.find(scopeQueryForUser(req.user, { group: groupName }))
      .populate('supervisor', 'fullName avatarPath role').populate('user','fullName role avatarPath')
      .sort({ course: 1, fullName: 1 })
      .lean();
    if (!students.length) return res.status(404).render('errors/404', { title: 'Guruh topilmadi' });

    const studentIds = students.map(student => student._id);
    const [activities, approvedSubmissions] = await Promise.all([
      ScientificActivity.find({
        student: { $in: studentIds },
        status: { $in: ['accepted', 'published', 'completed'] }
      }).select('student type title date status submission createdAt').sort({ date: -1, createdAt: -1 }).lean(),
      ResearchSubmission.find({ student: { $in: studentIds }, status: 'approved' })
        .select('student type title completedAt updatedAt createdAt')
        .sort({ completedAt: -1, updatedAt: -1 })
        .lean()
    ]);

    const linkedSubmissionIds = new Set(activities.map(item => String(item.submission || '')).filter(Boolean));
    const workByStudent = new Map();
    const addWork = (studentId, work) => {
      const key = String(studentId);
      const current = workByStudent.get(key) || { count: 0, latest: null };
      current.count += 1;
      if (!current.latest || new Date(work.date) > new Date(current.latest.date)) current.latest = work;
      workByStudent.set(key, current);
    };
    activities.forEach(item => addWork(item.student, {
      title: item.title,
      type: SCIENCE_TYPE_LABELS[item.type] || 'Ilmiy ish',
      date: item.date || item.createdAt
    }));
    approvedSubmissions
      .filter(item => !linkedSubmissionIds.has(String(item._id)))
      .forEach(item => addWork(item.student, {
        title: item.title,
        type: SUBMISSION_TYPES[item.type] || 'Tasdiqlangan ish',
        date: item.completedAt || item.updatedAt || item.createdAt
      }));

    const groupStudents = students.map(student => ({
      ...student,
      portfolio: workByStudent.get(String(student._id)) || { count: 0, latest: null }
    }));
    const metrics = groupStudentMetrics(students, 'group')[0];

    res.render('dashboard/group', {
      title: `${groupName} guruhi`,
      groupName,
      students: groupStudents,
      metrics
    });
  } catch (e) { next(e); }
};

exports.live = async (req, res, next) => {
  try {
    const groupName = String(req.query.group || '').trim().slice(0, 120);
    const initial = await buildStudentOverview(req.user, groupName);
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();

    let closed = false;
    let running = false;
    const write = data => {
      if (!closed && !res.writableEnded) res.write(`event: stats\ndata: ${JSON.stringify(data)}\n\n`);
    };
    write(initial);

    const refresh = async () => {
      if (closed || running) return;
      running = true;
      try {
        write(await buildStudentOverview(req.user, groupName));
      } catch (_) {
        if (!closed && !res.writableEnded) res.write('event: stats-error\ndata: {}\n\n');
      } finally {
        running = false;
      }
    };
    const refreshTimer = setInterval(refresh, 8000);
    const heartbeatTimer = setInterval(() => {
      if (!closed && !res.writableEnded) res.write(': heartbeat\n\n');
    }, 25000);
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(refreshTimer);
      clearInterval(heartbeatTimer);
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
  } catch (e) { next(e); }
};


exports.search = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q.length < 2) return res.json({ results: [] });
    const escaped = q.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&');
    const rx = new RegExp(escaped, 'i');
    const studentQuery = scopeQueryForUser(req.user, { $or: [
      { fullName: rx }, { studentId: rx }, { group: rx }, { faculty: rx }, { department: rx }, { specialty: rx }
    ]});
    const students = await Student.find(studentQuery).select('fullName studentId group faculty department').sort({ fullName: 1 }).limit(8).lean();
    const results = students.map(s => ({ type:'student', title:s.fullName, subtitle:[s.studentId,s.group,s.department].filter(Boolean).join(' • '), url:'/students/'+s._id }));
    if (['superadmin','tech','magistracy','dean','department'].includes(req.user.role)) {
      const userQuery = { $or: [{ fullName:rx },{ login:rx },{ employeeId:rx },{ phone:rx },{ email:rx }] };
      if (req.user.role === 'dean') userQuery.faculty = req.user.faculty;
      if (req.user.role === 'department') userQuery.department = req.user.department;
      const users = await User.find(userQuery).select('fullName login role faculty department').sort({ fullName:1 }).limit(6).lean();
      users.forEach(u => results.push({ type:'user', title:u.fullName, subtitle:[u.login,u.role,u.department].filter(Boolean).join(' • '), url:'/profile/'+u._id }));
    }
    res.json({ results: results.slice(0,12) });
  } catch (e) { next(e); }
};
