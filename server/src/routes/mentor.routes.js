const express = require('express');
const ctrl = require('../controllers/mentor.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// The whole module is personal — there is no public view of someone else's
// goals, brief, or analytics, so authentication is applied once here rather
// than repeated on every route.
router.use(authenticate);

router.get('/overview', ctrl.getOverview);
router.get('/analytics', ctrl.getAnalytics);

// --- Goal tracking ----------------------------------------------------------
router.get('/goals', ctrl.listGoals);
router.post('/goals', ctrl.createGoal);
router.patch('/goals/:id', ctrl.updateGoal);
router.delete('/goals/:id', ctrl.deleteGoal);

// --- Daily recommendations --------------------------------------------------
// "/brief/actions" is declared before nothing dynamic, but kept adjacent to the
// brief routes it belongs to.
router.get('/brief', ctrl.getBrief);
router.post('/brief', ctrl.generateBrief);
router.patch('/brief/actions', ctrl.toggleBriefAction);

// --- Personalised study plans -----------------------------------------------
router.get('/plans', ctrl.listPlans);
router.post('/plans', ctrl.createPlan);
router.get('/plans/:id', ctrl.getPlan);
router.patch('/plans/:id/items', ctrl.togglePlanItem);
router.delete('/plans/:id', ctrl.deletePlan);

module.exports = router;
