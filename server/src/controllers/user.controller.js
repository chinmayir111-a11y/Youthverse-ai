const User = require('../models/User');
const Profile = require('../models/Profile');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const normalizeTags = require('../utils/normalizeTags');

// Fields a user is allowed to change on their own profile.
const PROFILE_FIELDS = [
  'bio',
  'location',
  'educationLevel',
  'institution',
  'fieldOfStudy',
  'graduationYear',
  'skills',
  'interests',
  'goals',
  'githubUrl',
  'linkedinUrl',
  'portfolioUrl',
];

// GET /api/users/me/profile
const getMyProfile = asyncHandler(async (req, res) => {
  // Upsert-on-read: covers users created before profiles existed.
  let profile = await Profile.findOne({ user: req.user._id });
  if (!profile) {
    profile = await Profile.create({ user: req.user._id });
  }

  res.json({
    success: true,
    data: { user: req.user.toPublicJSON(), profile: profile.toPublicJSON() },
  });
});

// PUT /api/users/me/profile
const updateMyProfile = asyncHandler(async (req, res) => {
  const updates = {};

  for (const field of PROFILE_FIELDS) {
    if (!(field in req.body)) continue;

    if (['skills', 'interests', 'goals'].includes(field)) {
      const tags = normalizeTags(req.body[field]);
      if (tags !== undefined) updates[field] = tags;
    } else if (field === 'graduationYear') {
      const raw = req.body[field];
      updates[field] = raw === null || raw === '' ? null : Number(raw);
    } else {
      updates[field] = req.body[field];
    }
  }

  // `name` lives on User, not Profile, but the profile form edits both.
  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    await User.findByIdAndUpdate(
      req.user._id,
      { name: req.body.name.trim() },
      { runValidators: true }
    );
  }

  const profile = await Profile.findOneAndUpdate({ user: req.user._id }, updates, {
    new: true,
    runValidators: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  const user = await User.findById(req.user._id);

  res.json({
    success: true,
    message: 'Profile updated',
    data: { user: user.toPublicJSON(), profile: profile.toPublicJSON() },
  });
});

// GET /api/users/:id  - public profile view
const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const profile = await Profile.findOne({ user: user._id });

  res.json({
    success: true,
    data: {
      user: user.toPublicJSON(),
      profile: profile ? profile.toPublicJSON() : null,
    },
  });
});

module.exports = { getMyProfile, updateMyProfile, getPublicProfile };
