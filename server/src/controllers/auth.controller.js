const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, SELF_ASSIGNABLE_ROLES } = require('../utils/constants');

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Moderator/admin are assigned, never self-selected.
  if (role && !SELF_ASSIGNABLE_ROLES.includes(role)) {
    throw new ApiError(400, `Role "${role}" cannot be self-assigned at registration`);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || ROLES.STUDENT,
  });

  // Every user gets an empty profile immediately, so the profile endpoints
  // never have to deal with a missing document.
  const profile = await Profile.create({ user: user._id });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: user.toPublicJSON(),
      profile: profile.toPublicJSON(),
      token: generateToken(user),
    },
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Same generic message for unknown email and wrong password, so the endpoint
  // can't be used to enumerate registered addresses.
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toPublicJSON(),
      token: generateToken(user),
    },
  });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id });

  res.json({
    success: true,
    data: {
      user: req.user.toPublicJSON(),
      profile: profile ? profile.toPublicJSON() : null,
    },
  });
});

module.exports = { register, login, getMe };
