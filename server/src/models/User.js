const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLE_VALUES, ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned unless explicitly selected
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.STUDENT,
    },
    avatarUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

// Hash password before saving.
// Mongoose 9: async pre-save hooks must NOT call next().
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Single place that decides what a user object looks like over the wire.
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatarUrl: this.avatarUrl,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
