const express = require('express');
const ctrl = require('../controllers/study.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { uploadPdf } = require('../middlewares/upload.middleware');

const router = express.Router();

// Everything in the Study Hub is private to the owning user.
router.use(authenticate);

router.post('/documents', uploadPdf, ctrl.uploadDocument);
router.get('/documents', ctrl.listDocuments);
router.get('/documents/:id', ctrl.getDocument);
router.delete('/documents/:id', ctrl.deleteDocument);

router.get('/documents/:id/chat', ctrl.getChatSession);
router.post('/documents/:id/chat', ctrl.sendChatMessage);

router.get('/documents/:id/artifacts', ctrl.listArtifacts);

// kind: quiz | flashcards | notes. Express 5 dropped inline regex constraints
// in paths, so the allowed values are enforced in the controller instead.
// This is declared after the more specific routes above so they win on match.
router.post('/documents/:id/:kind', ctrl.generateArtifact);

router.post('/explain', ctrl.explainTopic);

module.exports = router;
