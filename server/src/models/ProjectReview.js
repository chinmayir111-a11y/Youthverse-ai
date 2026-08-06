const mongoose = require('mongoose');

/**
 * SRS Module 8 - Feedback and Project Ratings.
 *
 * One row carries both: the star rating is the number, the comment is the
 * feedback. Splitting them into two collections would let a project accumulate
 * ten ratings and two unrelated comments with no way to tell which reviewer
 * meant what, and the unique index below would have to be duplicated anyway.
 *
 * The unique index on (project, reviewer) is what stops one person rating the
 * same project repeatedly. Revising an opinion is an update, not a second row.
 */
const projectReviewSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

projectReviewSchema.index({ project: 1, reviewer: 1 }, { unique: true });

const userRef = (value) =>
  value && value._id
    ? { id: value._id, name: value.name, role: value.role, avatarUrl: value.avatarUrl }
    : value;

projectReviewSchema.methods.toPublicJSON = function (viewer = {}) {
  return {
    id: this._id,
    project: this.project,
    reviewer: userRef(this.reviewer),
    rating: this.rating,
    comment: this.comment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    canManage: Boolean(viewer.canManage),
  };
};

module.exports = mongoose.model('ProjectReview', projectReviewSchema);
