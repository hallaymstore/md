const Upload = require('../models/Upload');
const Student = require('../models/Student');
const { scopeQueryForUser } = require('../middleware/auth');
const audit = require('../services/audit');

exports.index = async (req, res, next) => {
  try {
    let studentQuery = scopeQueryForUser(req.user, {});
    const students = await Student.find(studentQuery).select('fullName group faculty department').sort({ fullName: 1 }).lean();
    const studentIds = students.map(s => s._id);
    let uploadQuery = {};
    if (req.user.role === 'dean') uploadQuery = { $or: [{ faculty: req.user.faculty }, { student: { $in: studentIds } }] };
    else if (req.user.role === 'department') uploadQuery = { $or: [{ department: req.user.department }, { student: { $in: studentIds } }] };
    else if (['supervisor','teacher','student'].includes(req.user.role)) uploadQuery = { student: { $in: studentIds } };
    const uploads = await Upload.find(uploadQuery).populate('uploadedBy','fullName role').populate('student','fullName').sort({ createdAt: -1 }).limit(150).lean();
    res.render('uploads/index', { title: 'Materiallar va hujjatlar', uploads, students });
  } catch (e) { next(e); }
};

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) {
      req.session.flash = { type: 'error', text: 'Fayl tanlanmagan.' };
      return res.redirect('/uploads');
    }
    let allowedStudent = null;
    if (req.user.role === 'student' && !req.body.student) {
      allowedStudent = await Student.findOne(scopeQueryForUser(req.user, {}));
      if (allowedStudent) req.body.student = allowedStudent._id.toString();
    }
    if (req.body.student) {
      allowedStudent = allowedStudent || await Student.findOne(scopeQueryForUser(req.user, { _id: req.body.student }));
      if (!allowedStudent && !['superadmin','tech','management','magistracy'].includes(req.user.role)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
      if (!allowedStudent) allowedStudent = await Student.findById(req.body.student);
    }
    const item = await Upload.create({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      path: `/static/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category: req.body.category || 'source',
      description: req.body.description,
      faculty: allowedStudent?.faculty || req.body.faculty || req.user.faculty,
      department: allowedStudent?.department || req.body.department || req.user.department,
      student: req.body.student || undefined,
      uploadedBy: req.user._id
    });
    await audit(req, 'FILE_UPLOADED', 'Upload', item._id, { name: item.originalName, category: item.category });
    req.session.flash = { type: 'success', text: 'Fayl yuklandi.' };
    res.redirect('/uploads');
  } catch (e) { next(e); }
};
