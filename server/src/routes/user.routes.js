const express = require('express');
const { body } = require('express-validator');
const {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
} = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const optionalUrl = (field) =>
  body(field)
    .optional({ values: 'falsy' })
    .isURL({ require_protocol: true })
    .withMessage(`${field} must be a full URL including https://`);

router.get('/me/profile', authenticate, getMyProfile);

router.put(
  '/me/profile',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2, max: 50 }),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
    body('graduationYear')
      .optional({ values: 'null' })
      .isInt({ min: 1950, max: 2100 })
      .withMessage('Graduation year must be between 1950 and 2100'),
    body('skills').optional().isArray().withMessage('skills must be an array'),
    body('interests').optional().isArray().withMessage('interests must be an array'),
    body('goals').optional().isArray().withMessage('goals must be an array'),
    optionalUrl('githubUrl'),
    optionalUrl('linkedinUrl'),
    optionalUrl('portfolioUrl'),
  ],
  validate,
  updateMyProfile
);

router.get('/:id', getPublicProfile);

module.exports = router;
