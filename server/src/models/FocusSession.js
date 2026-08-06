const mongoose = require('mongoose');

/**
 * SRS Module 11 - Pomodoro Timer.
 *
 * The timer itself runs in the browser. This records what it finished, because
 * a timer the server drives would stop being accurate the moment a tab sleeps
 * or a phone locks, and would need a heartbeat to stay honest about something
 * the client already knows.
 *
 * Only completed intervals are posted, so "focus minutes this week" counts
 * work that actually happened rather than timers that were started.
 */
const focusSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    day: { type: String, required: true, index: true },
    minutes: { type: Number, required: true, min: 1, max: 240 },

    // What they were working on. Free text: it is a label for their own review,
    // not something the app groups by.
    label: { type: String, default: '', maxlength: 200 },

    // Breaks are recorded too, so the ratio is visible, but they are excluded
    // from focus totals.
    kind: { type: String, enum: ['focus', 'break'], default: 'focus', index: true },

    endedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

focusSessionSchema.index({ owner: 1, day: 1 });

focusSessionSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    day: this.day,
    minutes: this.minutes,
    label: this.label,
    kind: this.kind,
    endedAt: this.endedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('FocusSession', focusSessionSchema);
