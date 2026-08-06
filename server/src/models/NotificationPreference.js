const mongoose = require('mongoose');
const { CATEGORIES } = require('./Notification');

/**
 * Which categories a person wants to hear about.
 *
 * Stored as a list of *muted* categories rather than enabled ones, so a
 * category added later is on by default for everyone who has never opened
 * this screen — the alternative silently hides new notification types from
 * every existing user.
 */
const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    muted: {
      type: [String],
      default: [],
      validate: {
        validator: (list) => list.every((c) => CATEGORIES.includes(c)),
        message: 'Unknown notification category',
      },
    },
  },
  { timestamps: true }
);

notificationPreferenceSchema.methods.toPublicJSON = function () {
  return {
    categories: CATEGORIES,
    muted: this.muted,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
