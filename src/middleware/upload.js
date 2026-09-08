const path = require('path');
const multer = require('multer');

const allowed = new Set(['.pdf','.doc','.docx','.xls','.xlsx','.csv','.json','.txt','.png','.jpg','.jpeg','.webp','.zip','.ppt','.pptx']);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60);
    cb(null, `${Date.now()}-${safe}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.UPLOAD_LIMIT_MB || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.has(ext) ? null : new Error('Bu fayl turi ruxsat etilmagan'), allowed.has(ext));
  }
});

module.exports = upload;
