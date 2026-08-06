const fs = require('fs');

/**
 * Discard anything multer already wrote to disk for a request that is now
 * failing.
 *
 * Multer runs before validation, so by the time a bad title or an unknown
 * category is rejected the file is already on disk with nothing left to
 * reference it. Cleaning up here rather than in each controller covers the
 * validator, the controller's own guards, and any route added later — without
 * it, repeatedly posting a valid file with an invalid field fills the disk.
 *
 * Only disk storage sets `path`; the study-document upload keeps its buffer in
 * memory and has nothing to remove.
 */
const discardUploads = (req) => {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : [])];
  for (const file of files) {
    if (!file?.path) continue;
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[upload] could not discard ${file.path}: ${error.message}`);
      }
    }
  }
};

// Global error handling middleware
const errorMiddleware = (err, req, res, _next) => {
  discardUploads(req);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || { field: '' })[0];
    message = `${field} already exists`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  }

  console.error(
    `[Error] ${statusCode} - ${message}`,
    process.env.NODE_ENV === 'development' ? err.stack : ''
  );

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
