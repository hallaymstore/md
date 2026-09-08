const { buildDashboardData } = require('../services/dashboardData');

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
    res.render('dashboard/index', {
      title: 'Boshqaruv paneli',
      dashboardView: `roles/${ROLE_VIEW[req.user.role] || 'student'}`,
      ...data
    });
  } catch (e) { next(e); }
};
