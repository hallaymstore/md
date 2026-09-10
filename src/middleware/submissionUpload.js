const fs = require('fs');
const path = require('path');
const multer = require('multer');

const targetDir = path.join(__dirname, '../../storage/submissions');
fs.mkdirSync(targetDir, { recursive: true });

const allowed = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.zip', '.ppt', '.pptx']);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, targetDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 55) || 'file';
    const nonce = Math.random().toString(36).slice(2, 9);
    cb(null, `${Date.now()}-${nonce}-${safe}${ext}`);
  }
});

module.exports = multer({
  storage,
  limits: {
    fileSize: Number(process.env.SUBMISSION_FILE_LIMIT_MB || 25) * 1024 * 1024,
    files: Number(process.env.SUBMISSION_MAX_FILES || 5)
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = allowed.has(ext);
    cb(ok ? null : new Error('Arizaga bu fayl turini biriktirish mumkin emas.'), ok);
  }
});
