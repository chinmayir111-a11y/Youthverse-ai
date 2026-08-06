const mongoose = require('mongoose');

// SRS Module 11 - Mood Tracker.
//
// A 1-5 scale with fixed meanings, so a 2 in March means what a 2 meant in
// January. Stored as the number; the labels live in one place on the client.
const MOOD_MIN = 1;
const MOOD_MAX = 5;

// What the student says was going on. A fixed list rather than free tags: the
// point is to spot a pattern across weeks, and free text never groups.
const FACTORS = [
  'sleep',
  'workload',
  'exams',
  'health',
  'social',
  'family',
  'money',
  'other',
];

/**
 * One entry per person per day.
 *
 * This is the most sensitive collection in the app. It is never populated into
 * anyone else's response, never aggregated across users, and has no public
 * projection — the only reader is the person who wrote it. `note` in
 * particular is private text and is not sent to the AI provider (see
 * wellbeing.controller.js).
 */
const moodEntrySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    day: { type: String, required: true },

    mood: { type: Number, required: true, min: MOOD_MIN, max: MOOD_MAX },
    energy: { type: Number, min: MOOD_MIN, max: MOOD_MAX, default: null },
    sleepHours: { type: Number, min: 0, max: 24, default: null },

    factors: { type: [String], default: [] },
    note: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

moodEntrySchema.index({ owner: 1, day: 1 }, { unique: true });

moodEntrySchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    day: this.day,
    mood: this.mood,
    energy: this.energy,
    sleepHours: this.sleepHours,
    factors: this.factors,
    note: this.note,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('MoodEntry', moodEntrySchema);
module.exports.FACTORS = FACTORS;
module.exports.MOOD_MIN = MOOD_MIN;
module.exports.MOOD_MAX = MOOD_MAX;
