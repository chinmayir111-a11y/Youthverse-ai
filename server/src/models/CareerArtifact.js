const mongoose = require('mongoose');

/**
 * A generated Career Hub output: an ATS report, a skill-gap analysis, a
 * roadmap, or a company prep brief.
 *
 * Like StudyArtifact, `payload` is Mixed — its shape is already pinned by the
 * Zod schema in ai/schemas.js at generation time, and re-declaring four
 * variants as sub-schemas would only be a second place to keep in sync.
 *
 * `input` keeps what was asked for (the job description, the target role) so a
 * saved report is still interpretable months later.
 */
const KINDS = ['ats', 'skill_gap', 'roadmap', 'company_prep'];

const careerArtifactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: { type: String, enum: KINDS, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },

    // Roadmaps only: which milestones the student has ticked off. Keys are
    // assigned server-side as "<phaseIndex>.<milestoneIndex>" because ids that
    // come back from a model aren't stable enough to store progress against.
    completedMilestones: { type: [String], default: [] },
  },
  { timestamps: true }
);

careerArtifactSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    kind: this.kind,
    title: this.title,
    input: this.input,
    payload: this.payload,
    completedMilestones: this.completedMilestones,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('CareerArtifact', careerArtifactSchema);
module.exports.KINDS = KINDS;
