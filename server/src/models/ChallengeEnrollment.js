const mongoose = require('mongoose');
const { CHALLENGE_KEYS } = require('../utils/wellbeingContent');

const STATUSES = ['active', 'completed', 'abandoned'];

/**
 * SRS Module 11 - Digital Wellness Challenges.
 *
 * The challenges themselves are a curated catalog in utils/wellbeingContent.js;
 * this is one person's run at one of them. `challengeKey` references the
 * catalog rather than copying it, so improving a challenge's wording doesn't
 * mean migrating everyone mid-run.
 */
const challengeEnrollmentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    challengeKey: { type: String, enum: CHALLENGE_KEYS, required: true },

    // Days ticked off, as "YYYY-MM-DD" keys. A set rather than a counter so
    // ticking the same day twice can't inflate it, and so a run is legible
    // afterwards — which days actually happened, not just how many.
    completedDays: { type: [String], default: [] },

    status: { type: String, enum: STATUSES, default: 'active', index: true },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * One *active* run per challenge per person.
 *
 * Partial rather than a plain unique index: finishing a challenge and starting
 * it again next term is the intended path, and someone who abandoned one in
 * exam week should be able to come back to it.
 */
challengeEnrollmentSchema.index(
  { owner: 1, challengeKey: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('ChallengeEnrollment', challengeEnrollmentSchema);
module.exports.STATUSES = STATUSES;
