const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/resource.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { uploadResourceFile } = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// --- Public browsing --------------------------------------------------------
// optionalAuth so anyone can read the library, while a signed-in visitor still
// gets their own vote and saved state back on each resource.
router.get('/', optionalAuth, ctrl.listResources);
router.get('/meta', optionalAuth, ctrl.getMeta);

// --- Authenticated ----------------------------------------------------------
// Declared before "/:id" so "me" and "recommend" are never read as ids.
router.get('/me', authenticate, ctrl.listMine);
router.get('/me/saved', authenticate, ctrl.listSaved);
router.post('/recommend', authenticate, ctrl.recommendResources);

router.get('/:id', optionalAuth, ctrl.getResource);

router.post(
  '/',
  authenticate,
  // Multer runs first: on a multipart request the text fields don't exist on
  // req.body until it has parsed them, so validators before it see nothing.
  uploadResourceFile,
  [
    body('type').notEmpty().withMessage('Pick a category'),
    body('title').trim().isLength({ min: 4, max: 200 }).withMessage('Title must be 4-200 characters'),
  ],
  validate,
  ctrl.createResource
);

router.patch('/:id', authenticate, ctrl.updateResource);
router.delete('/:id', authenticate, ctrl.deleteResource);

// Authenticated on purpose — see the note on the controller. Browsing the
// library is public; pulling the files out of it is not.
router.get('/:id/download', authenticate, ctrl.downloadResource);

router.post('/:id/vote', authenticate, ctrl.voteResource);
router.post('/:id/save', authenticate, ctrl.saveResource);
router.delete('/:id/save', authenticate, ctrl.unsaveResource);

module.exports = router;
