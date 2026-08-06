const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { SELF_ASSIGNABLE_ROLES } = require('../utils/constants');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('role')
      .optional()
      .isIn(SELF_ASSIGNABLE_ROLES)
      .withMessage(`Role must be one of: ${SELF_ASSIGNABLE_ROLES.join(', ')}`),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', authenticate, getMe);

module.exports = router;
