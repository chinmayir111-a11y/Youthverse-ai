const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/forum.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// --- Public reads -----------------------------------------------------------
// optionalAuth so anonymous visitors can browse, while logged-in users still
// get their own vote state back on each item.
router.get('/communities', optionalAuth, ctrl.listCommunities);
router.get('/communities/:slug', optionalAuth, ctrl.getCommunity);
router.get('/communities/:slug/threads', optionalAuth, ctrl.listThreads);
router.get('/threads/:id', optionalAuth, ctrl.getThread);
router.get('/search', optionalAuth, ctrl.searchThreads);

// --- Authenticated writes ---------------------------------------------------
router.post(
  '/communities',
  authenticate,
  [
    body('name').trim().isLength({ min: 3, max: 60 }).withMessage('Name must be 3-60 characters'),
    body('description').optional().isLength({ max: 300 }),
  ],
  validate,
  ctrl.createCommunity
);

router.post(
  '/communities/:slug/threads',
  authenticate,
  [
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('body').trim().isLength({ min: 10, max: 10000 }).withMessage('Body must be at least 10 characters'),
    body('tags').optional().isArray().withMessage('tags must be an array'),
  ],
  validate,
  ctrl.createThread
);

router.post('/threads/:id/vote', authenticate, ctrl.voteThread);
router.post('/threads/:id/best-answer', authenticate, ctrl.setBestAnswer);
router.post('/threads/:id/summary', authenticate, ctrl.summarizeThread);
router.delete('/threads/:id', authenticate, ctrl.deleteThread);

router.post(
  '/threads/:id/comments',
  authenticate,
  [body('body').trim().isLength({ min: 1, max: 5000 }).withMessage('Comment cannot be empty')],
  validate,
  ctrl.createComment
);

router.post('/comments/:id/vote', authenticate, ctrl.voteComment);
router.delete('/comments/:id', authenticate, ctrl.deleteComment);

// --- Moderation -------------------------------------------------------------
router.post(
  '/threads/:id/lock',
  authenticate,
  authorize(ROLES.MODERATOR, ROLES.ADMIN),
  ctrl.setThreadLock
);

module.exports = router;
