const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');

const userSchema = new mongoose.Schema({
  login: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: Object.values(ROLES), index: true },
  fullName: { type: String, required: true, trim: true },
  employeeId: { type: String, trim: true },
  faculty: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLoginAt: Date
}, { timestamps: true });

userSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.verifyPassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
