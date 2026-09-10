const fs = require('fs');
const path = require('path');
const multer = require('multer');

const destination = path.join(__dirname, '../../public/uploads/avatars');
fs.mkdirSync(destination, { recursive: true });

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, destination),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${req.user._id}-${Date.now()}${allowedExt.has(ext) ? ext : '.jpg'}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok = allowedExt.has(ext) && allowedMime.has(file.mimetype);
    cb(ok ? null : new Error('Profil rasmi JPG, PNG yoki WEBP formatida bo‘lishi kerak.'), ok);
  }
});
