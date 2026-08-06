const mongoose = require('mongoose');

/**
 * SRS Module 12 - Notifications.
 *
 * Every type declares the category it belongs to, so muting is data-driven:
 * adding a type never means remembering to update a switch somewhere else.
 * The five categories map onto the SRS feature list — discussions,
 * opportunities (internship + scholarship alerts), reminders (events and
 * deadlines), suggestions — plus `collaboration`, which is the cross-module
 * traffic the rest of the app has been generating with nowhere to put it.
 */
const TYPES = Object.freeze({
  'discussion.reply': 'discussions',
  'discussion.best_answer': 'discussions',
  'discussion.new': 'discussions',

  'opportunity.internship': 'opportunities',
  'opportunity.scholarship': 'opportunities',

  'reminder.deadline': 'reminders',
  'reminder.session': 'reminders',
  'reminder.goal': 'reminders',

  'suggestion.brief': 'suggestions',

  'collab.request': 'collaboration',
  'collab.accepted': 'collaboration',
  'collab.declined': 'collaboration',
  'project.review': 'collaboration',
  'mentorship.requested': 'collaboration',
  'mentorship.status': 'collaboration',
  'mentorship.message': 'collaboration',
});

const TYPE_KEYS = Object.keys(TYPES);
const CATEGORIES = [...new Set(Object.values(TYPES))];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: { type: String, enum: TYPE_KEYS, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 500 },

    // Where clicking it goes, as an in-app path. Stored rather than derived so
    // a notification still points somewhere sensible after the thing that
    // caused it has changed shape.
    link: { type: String, default: '', maxlength: 300 },

    // Who caused it, when a person did. Null for anything time-derived.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /**
     * Stable key for anything that could be generated more than once.
     *
     * Time-based alerts are computed when the user asks for them rather than
     * by a scheduler, so the same deadline would otherwise produce a fresh row
     * every sync. The unique index below makes the second attempt a no-op.
     * Event notifications leave this null — each event is its own thing.
     */
    dedupeKey: { type: String, default: null },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The list query: one person's notifications, newest first.
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Partial so that the many rows with a null dedupeKey don't collide with each
// other — only genuinely keyed rows are constrained.
notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

const actorRef = (value) =>
  value && value._id ? { id: value._id, name: value.name, avatarUrl: value.avatarUrl } : null;

notificationSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    type: this.type,
    category: TYPES[this.type],
    title: this.title,
    body: this.body,
    link: this.link,
    actor: actorRef(this.actor),
    read: this.read,
    readAt: this.readAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.TYPES = TYPES;
module.exports.TYPE_KEYS = TYPE_KEYS;
module.exports.CATEGORIES = CATEGORIES;
