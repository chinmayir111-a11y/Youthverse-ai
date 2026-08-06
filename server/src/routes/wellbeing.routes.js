const express = require('express');
const ctrl = require('../controllers/wellbeing.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// Every route here reads or writes something private. There is no public view
// of anyone's mood, habits, or focus time — not even an aggregate one — so
// authentication is applied once here rather than repeated per route.
router.use(authenticate);

router.get('/overview', ctrl.getOverview);
router.post('/checkin', ctrl.generateCheckin);

// --- Mood tracker -----------------------------------------------------------
router.get('/mood', ctrl.listMood);
router.post('/mood', ctrl.logMood);
router.delete('/mood/:day', ctrl.deleteMood);

// --- Habit tracker ----------------------------------------------------------
router.get('/habits', ctrl.listHabits);
router.post('/habits', ctrl.createHabit);
router.patch('/habits/:id', ctrl.updateHabit);
router.delete('/habits/:id', ctrl.deleteHabit);
router.post('/habits/:id/log', ctrl.logHabit);

// --- Pomodoro ---------------------------------------------------------------
router.get('/focus', ctrl.listFocus);
router.post('/focus', ctrl.logFocus);

// --- Productivity tips ------------------------------------------------------
router.get('/tips', ctrl.listTips);

// --- Digital wellness challenges --------------------------------------------
router.get('/challenges', ctrl.listChallenges);
router.post('/challenges/:key/join', ctrl.joinChallenge);
router.post('/challenges/:key/checkin', ctrl.checkinChallenge);
router.post('/challenges/:key/leave', ctrl.leaveChallenge);

module.exports = router;
