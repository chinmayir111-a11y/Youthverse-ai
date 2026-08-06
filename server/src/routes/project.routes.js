const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/project.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// --- Public browsing --------------------------------------------------------
// optionalAuth so anyone can read the marketplace, while a signed-in visitor
// still gets their own rating and request state back on each project.
router.get('/', optionalAuth, ctrl.listProjects);
router.get('/meta', optionalAuth, ctrl.getMeta);

// --- Authenticated ----------------------------------------------------------
// Declared before "/:id" so "me", "ideas", and "requests" are never read as ids.
router.get('/me', authenticate, ctrl.listMine);
router.get('/me/requests', authenticate, ctrl.listMyRequests);
router.post('/ideas', authenticate, ctrl.generateIdeas);
router.patch('/requests/:requestId', authenticate, ctrl.updateRequest);
router.delete('/reviews/:reviewId', authenticate, ctrl.deleteReview);

router.get('/:id', optionalAuth, ctrl.getProject);

router.post(
  '/',
  authenticate,
  [
    body('title').trim().isLength({ min: 4, max: 160 }).withMessage('Title must be 4-160 characters'),
    body('description')
      .trim()
      .isLength({ min: 20, max: 5000 })
      .withMessage('Describe it in at least 20 characters'),
  ],
  validate,
  ctrl.createProject
);

router.patch('/:id', authenticate, ctrl.updateProject);
router.delete('/:id', authenticate, ctrl.deleteProject);

// --- Feedback and ratings ---------------------------------------------------
router.get('/:id/reviews', optionalAuth, ctrl.listReviews);
router.post('/:id/reviews', authenticate, ctrl.reviewProject);

// --- Teammates --------------------------------------------------------------
router.get('/:id/requests', authenticate, ctrl.listProjectRequests);
router.post('/:id/requests', authenticate, ctrl.requestCollaboration);
router.delete('/:id/collaborators/:userId', authenticate, ctrl.removeCollaborator);

module.exports = router;
