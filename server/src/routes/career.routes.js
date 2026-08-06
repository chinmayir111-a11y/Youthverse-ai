const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/career.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// The Career Hub is entirely personal: a resume, applications, and interview
// answers are nobody else's business, so nothing here is public.
router.use(authenticate);

router.get('/overview', ctrl.getOverview);

// --- Resume Builder + ATS ---------------------------------------------------
router.get('/resume', ctrl.getResume);
router.put('/resume', ctrl.updateResume);
router.post('/resume/ats', ctrl.analyzeResume);

// --- Generated reports ------------------------------------------------------
router.post(
  '/skill-gap',
  [body('targetRole').trim().isLength({ min: 2, max: 160 }).withMessage('Target role is required')],
  validate,
  ctrl.skillGap
);

router.post(
  '/roadmap',
  [body('goal').trim().isLength({ min: 3, max: 200 }).withMessage('A goal is required')],
  validate,
  ctrl.roadmap
);

router.post(
  '/company-prep',
  [
    body('company').trim().isLength({ min: 1, max: 120 }).withMessage('A company is required'),
    body('role').trim().isLength({ min: 2, max: 160 }).withMessage('A role is required'),
  ],
  validate,
  ctrl.companyPrep
);

router.get('/artifacts', ctrl.listArtifacts);
router.get('/artifacts/:id', ctrl.getArtifact);
router.delete('/artifacts/:id', ctrl.deleteArtifact);
router.patch('/artifacts/:id/milestones', ctrl.setMilestone);

// --- Mock interviews --------------------------------------------------------
router.post(
  '/interviews',
  [body('role').trim().isLength({ min: 2, max: 160 }).withMessage('A role is required')],
  validate,
  ctrl.startInterview
);
router.get('/interviews', ctrl.listInterviews);
router.get('/interviews/:id', ctrl.getInterview);
router.put('/interviews/:id/answers', ctrl.saveAnswers);
router.post('/interviews/:id/feedback', ctrl.gradeInterview);
router.delete('/interviews/:id', ctrl.deleteInterview);

// --- Placement tracker ------------------------------------------------------
router.get('/applications', ctrl.listApplications);
router.post(
  '/applications',
  [
    body('company').trim().isLength({ min: 1, max: 120 }).withMessage('A company is required'),
    body('role').trim().isLength({ min: 1, max: 160 }).withMessage('A role is required'),
  ],
  validate,
  ctrl.createApplication
);
router.patch('/applications/:id', ctrl.updateApplication);
router.delete('/applications/:id', ctrl.deleteApplication);

// --- AI career guidance -----------------------------------------------------
router.get('/guidance', ctrl.getGuidanceSession);
router.post('/guidance', ctrl.sendGuidanceMessage);
router.delete('/guidance', ctrl.clearGuidance);

module.exports = router;
