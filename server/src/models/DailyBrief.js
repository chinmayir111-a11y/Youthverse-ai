const mongoose = require('mongoose');

/**
 * SRS Module 10 - Daily Recommendations.
 *
 * One brief per person per day, enforced by the unique index below.
 * Regenerating on every page load would burn tokens and — worse — hand the
 * student a different plan every time they refreshed, which is the opposite of
 * what a daily plan is for. An explicit "rewrite today's brief" replaces the
 * row rather than adding a second one.
 *
 * `day` is a "YYYY-MM-DD" string in the server's own timezone rather than a
 * Date, because "today" is a calendar question, not an instant. Same caveat as
 * the mentorship availability windows: fine for one campus, and the thing to
 * revisit before this crosses time zones.
 */
const dailyBriefSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    day: { type: String, required: true },

    // Shape is pinned by dailyBriefSchema in ai/schemas.js at generation time,
    // the same reasoning as StudyArtifact and CareerArtifact.
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    // Which of the suggested actions the student ticked off, by position.
    // Positional for the same reason roadmap milestones are: ids returned by a
    // model are not stable enough to store progress against.
    completedActions: { type: [Number], default: [] },
  },
  { timestamps: true }
);

dailyBriefSchema.index({ owner: 1, day: 1 }, { unique: true });

dailyBriefSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    day: this.day,
    payload: this.payload,
    completedActions: this.completedActions,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('DailyBrief', dailyBriefSchema);
