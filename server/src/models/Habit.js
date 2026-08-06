const mongoose = require('mongoose');

// SRS Module 11 - Habit Tracker.
const habitSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    detail: { type: String, default: '', maxlength: 500 },

    /**
     * Which days this habit applies to, 0 = Sunday. Defaults to every day.
     *
     * This is what makes streaks honest: a weekday-only habit is not broken by
     * a Saturday, so Saturday is skipped when counting rather than treated as
     * a miss.
     */
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },

    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

habitSchema.methods.appliesOn = function (weekday) {
  return this.daysOfWeek.includes(weekday);
};

habitSchema.methods.toPublicJSON = function (extra = {}) {
  return {
    id: this._id,
    title: this.title,
    detail: this.detail,
    daysOfWeek: this.daysOfWeek,
    archived: Boolean(this.archivedAt),
    createdAt: this.createdAt,
    // Streaks and today's state are computed from the logs by the controller
    // rather than cached here, so they can never drift out of step with them.
    ...extra,
  };
};

module.exports = mongoose.model('Habit', habitSchema);
