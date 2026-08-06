const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Pull "Bearer <token>" off the request, or null.
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
};

// Verify a token and load the user. Throws ApiError(401) on any failure.
const resolveUser = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw new ApiError(401, 'Token has expired');
    throw new ApiError(401, 'Invalid token');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError(401, 'User no longer exists');
  return user;
};

// Require a valid token. Attaches req.user.
const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw new ApiError(401, 'Authentication required. Please provide a valid token.');
  }
  req.user = await resolveUser(token);
  next();
});

// Attach req.user when a valid token is present, but never reject.
// Used for public-but-personalized routes (e.g. browsing forum threads while
// still showing which posts you've already voted on).
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = await resolveUser(token);
  } catch {
    req.user = undefined; // bad token on a public route: treat as anonymous
  }
  next();
});

module.exports = { authenticate, optionalAuth };
