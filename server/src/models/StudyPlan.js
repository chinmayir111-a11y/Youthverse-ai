const mongoose = require('mongoose');

/**
 * SRS Module 10 - Personalized Study Plans.
 *
 * Distinct from a Career Hub roadmap: a roadmap answers "how do I become a
 * backend engineer" over months, this answers "what do I do each week to be
 * ready for the thing in front of me". Different horizon, different shape, so
 * it is its own collection rather than another CareerArtifact kind.
 *
 * `input` keeps what was asked for so a saved plan is still interpretable
 * weeks later, the same reason CareerArtifact keeps it.
 */
const studyPlanSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Optional: a plan can stand alone, or be the "how" for a tracked goal.
    // Kept nullable rather than required so the two features don't force each
    // other on the student.
    goal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
      default: null,
      index: true,
    },

    title: { type: String, required: true, maxlength: 200 },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    // Ticked tasks, keyed "<weekIndex>.<taskIndex>" and assigned server-side —
    // the same contract the Career Hub roadmap uses, and for the same reason:
    // ids that come back from a model aren't stable enough to store against.
    completedItems: { type: [String], default: [] },
  },
  { timestamps: true }
);

studyPlanSchema.methods.taskCount = function () {
  return (this.payload?.weeks ?? []).reduce(
    (total, week) => total + (week.tasks?.length ?? 0),
    0
  );
};

studyPlanSchema.methods.toPublicJSON = function () {
  const total = this.taskCount();

  return {
    id: this._id,
    goal: this.goal,
    title: this.title,
    input: this.input,
    payload: this.payload,
    completedItems: this.completedItems,
    taskCount: total,
    // Derived so the client and the server can't disagree about the number.
    progress: total === 0 ? 0 : Math.round((this.completedItems.length / total) * 100),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
