const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/mentorship.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// --- Browsing is public -----------------------------------------------------
// optionalAuth rather than none, so a mentor previewing their own unpublished
// page is recognised as its owner instead of getting a 404.
router.get('/mentors', optionalAuth, ctrl.listMentors);
router.get('/mentors/:id/reviews', optionalAuth, ctrl.listReviews);

// --- The mentor's own listing ----------------------------------------------
// Declared before "/mentors/:id" so "me" is never read as a user id.
router.get(
  '/me/mentor-profile',
  authenticate,
  authorize(ROLES.MENTOR, ROLES.ADMIN),
  ctrl.getMyMentorProfile
);
router.put(
  '/me/mentor-profile',
  authenticate,
  authorize(ROLES.MENTOR, ROLES.ADMIN),
  ctrl.updateMyMentorProfile
);

router.get('/mentors/:id', optionalAuth, ctrl.getMentor);

// --- Everything below needs an account --------------------------------------
router.use(authenticate);

router.get('/overview', ctrl.getOverview);
router.post('/match', ctrl.matchMentors);

router.post(
  '/sessions',
  [
    body('mentorId').isMongoId().withMessage('A mentor is required'),
    body('topic').trim().isLength({ min: 3, max: 200 }).withMessage('Topic must be 3-200 characters'),
    body('scheduledFor').notEmpty().withMessage('A date and time is required'),
  ],
  validate,
  ctrl.requestSession
);
router.get('/sessions', ctrl.listSessions);
router.get('/sessions/:id', ctrl.getSession);
router.patch('/sessions/:id', ctrl.updateSessionStatus);
router.post('/sessions/:id/review', ctrl.reviewSession);

router.get('/chats', ctrl.listChats);
router.get('/chats/:userId', ctrl.getChat);
router.post('/chats/:userId', ctrl.sendChatMessage);

module.exports = router;
