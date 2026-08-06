const mongoose = require('mongoose');

/**
 * One row per habit per day it was done.
 *
 * Rows exist only for completions — there is no "missed" row. A miss is the
 * absence of a row, which means un-ticking a day is a delete rather than a
 * flag to keep in step, and the collection stays proportional to work actually
 * done rather than to time elapsed.
 */
const habitLogSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    habit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
      index: true,
    },
    day: { type: String, required: true },
  },
  { timestamps: true }
);

// Ticking the same day twice is a no-op, not a second row.
habitLogSchema.index({ habit: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('HabitLog', habitLogSchema);
