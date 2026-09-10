require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = Number(process.env.PORT || 3001);
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/md';

async function boot() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Ma’lumotlar bazasi ulandi.');
    app.listen(PORT, () => {
      console.log('===============================================');
      console.log('MD v3.0.0');
      console.log(`MD: http://localhost:${PORT}/login`);
      console.log(`Katta ekran: http://localhost:${PORT}/display`);
      console.log('MD ishga tushdi.');
      console.log('===============================================');
    });
  } catch (error) {
    console.error('MD ishga tushmadi:', error.message);
    if (/ECONNREFUSED.*127\.0\.0\.1|ENOTFOUND|querySrv|Server selection/i.test(error.message || '')) {
      console.error('MongoDB URI tekshiring: .env ichida MONGODB_URI yoki MONGO_URI bo‘lishi kerak. Atlas bo‘lsa Network Access/IP ruxsatini ham tekshiring.');
    }
    process.exit(1);
  }
}

boot();
