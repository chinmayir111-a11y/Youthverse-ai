const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 5000 },

    upvotes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    downvotes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true }
);

commentSchema.index({ thread: 1, createdAt: 1 });

commentSchema.methods.score = function () {
  return this.upvotes.length - this.downvotes.length;
};

commentSchema.methods.toPublicJSON = function (viewerId, bestAnswerId) {
  const viewer = viewerId ? String(viewerId) : null;
  const author = this.populated('author') ? this.author : null;

  return {
    id: this._id,
    thread: this.thread,
    author: author ? { id: author._id, name: author.name, role: author.role } : this.author,
    body: this.body,
    score: this.score(),
    myVote: !viewer
      ? 0
      : this.upvotes.some((id) => String(id) === viewer)
        ? 1
        : this.downvotes.some((id) => String(id) === viewer)
          ? -1
          : 0,
    isBestAnswer: bestAnswerId ? String(bestAnswerId) === String(this._id) : false,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Comment', commentSchema);
