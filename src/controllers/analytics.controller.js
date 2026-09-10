const { buildDashboardData } = require('../services/dashboardData');

exports.index = async (req, res, next) => {
  try {
    const data = await buildDashboardData(req.user);
    res.render('analytics/index', { title: 'Kengaytirilgan tahlil', ...data });
  } catch (e) { next(e); }
};

exports.csv = async (req, res, next) => {
  try {
    const { students } = await buildDashboardData(req.user);
    const rows = [['F.I.Sh.','ID','Fakultet','Kafedra','Mutaxassislik','Kurs','Guruh','Davomat','Ozlashtirish','Individual reja','Dissertatsiya','Ilmiy faollik','Hujjatlar','Bitiruv tayyorligi','Akademik qarz','Holat']];
    students.forEach(s => rows.push([s.fullName,s.studentId||'',s.faculty||'',s.department||'',s.specialty||'',s.course||'',s.group||'',s.attendance,s.academicScore,s.individualPlan,s.dissertationProgress,s.scientificActivity,s.documentsCompleteness,s.graduationReadiness,s.academicDebtCount||0,s.status]));
    const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const csv = '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="md-monitor-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
};
