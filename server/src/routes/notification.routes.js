const express = require('express');
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// Notifications are addressed to one person; there is no public view.
router.use(authenticate);

// Fixed paths first, so "unread-count", "read-all", "read", and "preferences"
// are never read as notification ids.
router.get('/unread-count', ctrl.getUnreadCount);
router.get('/preferences', ctrl.getPreferences);
router.put('/preferences', ctrl.updatePreferences);
router.post('/sync', ctrl.syncNotifications);
router.post('/read-all', ctrl.markAllRead);
router.delete('/read', ctrl.clearRead);

router.get('/', ctrl.listNotifications);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.deleteNotification);

module.exports = router;
