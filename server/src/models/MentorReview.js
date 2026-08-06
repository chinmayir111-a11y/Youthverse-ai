const mongoose = require('mongoose');

/**
 * SRS Module 6 - Reviews and Mentor Ratings.
 *
 * A review is anchored to a session, not just to a mentor: the unique index on
 * `session` is what stops someone rating the same mentor repeatedly off a
 * single meeting, and it means every rating traces back to a session that
 * actually happened.
 */
const mentorReviewSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MentorshipSession',
      required: true,
      unique: true,
      index: true,
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

const userRef = (value) =>
  value && value._id ? { id: value._id, name: value.name, role: value.role } : value;

mentorReviewSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    session: this.session,
    mentor: userRef(this.mentor),
    mentee: userRef(this.mentee),
    rating: this.rating,
    comment: this.comment,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('MentorReview', mentorReviewSchema);
