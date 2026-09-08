require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = Number(process.env.PORT || 3001);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qdt_monitor';

async function boot() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log('===============================================');
      console.log('MD QDTU — APPROVAL WORKFLOW UI v2.5.0');
      console.log(`OPEN: http://localhost:${PORT}/login`);
      console.log('Login sahifasida APPROVAL WORKFLOW UI • v2.5 yozuvi ko‘rinishi kerak.');
      console.log('===============================================');
    });
  } catch (error) {
    console.error('Startup error:', error.message);
    process.exit(1);
  }
}

boot();
