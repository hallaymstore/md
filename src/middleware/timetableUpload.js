const path = require('path');
const multer = require('multer');

const allowed = new Set(['.xlsx']);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowed.has(ext)) return cb(new Error('Faqat .xlsx Excel fayli qabul qilinadi.'));
    cb(null, true);
  }
});
