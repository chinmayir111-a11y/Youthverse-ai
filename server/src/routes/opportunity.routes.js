const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/opportunity.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// --- Public browsing --------------------------------------------------------
// optionalAuth so anyone can read the hub, while a signed-in visitor still gets
// their own saved/tracked state back on each posting.
router.get('/', optionalAuth, ctrl.listOpportunities);
router.get('/meta', optionalAuth, ctrl.getMeta);

// --- Authenticated ----------------------------------------------------------
// Declared before "/:id" so "me" and "recommend" are never read as ids.
router.get('/me/saved', authenticate, ctrl.listSaved);
router.post('/recommend', authenticate, ctrl.recommendOpportunities);

router.get('/:id', optionalAuth, ctrl.getOpportunity);

router.post(
  '/',
  authenticate,
  [
    body('type').notEmpty().withMessage('Pick a category'),
    body('title').trim().isLength({ min: 4, max: 200 }).withMessage('Title must be 4-200 characters'),
    body('organisation').trim().isLength({ min: 2, max: 160 }).withMessage('An organisation is required'),
    body('description').trim().isLength({ min: 20, max: 5000 }).withMessage('Describe it in at least 20 characters'),
  ],
  validate,
  ctrl.createOpportunity
);

router.patch('/:id', authenticate, ctrl.updateOpportunity);
router.delete('/:id', authenticate, ctrl.deleteOpportunity);

router.post('/:id/save', authenticate, ctrl.saveOpportunity);
router.delete('/:id/save', authenticate, ctrl.unsaveOpportunity);
router.post('/:id/track', authenticate, ctrl.trackOpportunity);

module.exports = router;
