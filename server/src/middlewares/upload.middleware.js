const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Anthropic's PDF limits are 32 MB / 600 pages. We cap below the byte limit and
// let page-count overruns surface as a provider error on first use.
const MAX_BYTES = 25 * 1024 * 1024;

// Kept in memory: the buffer is forwarded straight to the provider's Files API,
// so writing it to disk would only create a second copy to clean up.
const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) {
      return cb(new ApiError(400, 'Only PDF files are supported'));
    }
    cb(null, true);
  },
}).single('file');

// ---------------------------------------------------------------------------
// Resource Library uploads
// ---------------------------------------------------------------------------

// Unlike a study document — which is forwarded straight to the provider and
// never kept — a shared resource has to stay downloadable, so these land on
// disk. `server/uploads/` is already gitignored except for its .gitkeep.
const RESOURCE_DIR = path.join(__dirname, '..', '..', 'uploads');
const RESOURCE_MAX_BYTES = 25 * 1024 * 1024;

// Extension allowlist, not a blocklist: the things students actually share,
// and nothing the server or a browser would execute.
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.md',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.zip',
]);

fs.mkdirSync(RESOURCE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RESOURCE_DIR),
  /**
   * The stored name is generated, never derived from what was uploaded.
   * The original name is kept as a plain field on the Resource and only ever
   * used as a download label, so a filename like "../../server.js" can't steer
   * a write and can't be turned back into a path on the way out.
   */
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadResourceFile = multer({
  storage,
  limits: { fileSize: RESOURCE_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new ApiError(400, `That file type isn't supported. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`)
      );
    }
    cb(null, true);
  },
  // Multer ignores anything that isn't multipart/form-data, so this same
  // handler also covers the link-only case posted as plain JSON.
}).single('file');

module.exports = {
  uploadPdf,
  MAX_BYTES,
  uploadResourceFile,
  RESOURCE_DIR,
  RESOURCE_MAX_BYTES,
  ALLOWED_EXTENSIONS,
};
