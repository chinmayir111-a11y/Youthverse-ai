const ApiError = require('../utils/ApiError');

// Factory: returns middleware that checks req.user.role against allowed roles.
// Must run after `authenticate`.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
};

module.exports = authorize;
