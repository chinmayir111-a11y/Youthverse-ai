const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: true,
      index: true,
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 10000 },
    tags: { type: [String], default: [] },

    // Voters are stored by id rather than as a counter so a user cannot vote
    // twice, and so we can tell the caller how *they* voted.
    upvotes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    downvotes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },

    bestAnswer: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    commentCount: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },

    // Cached AI Discussion Summary (SRS Module 5). Invalidated when the thread
    // gains comments, so a stale summary is never shown as current.
    summary: {
      type: {
        summary: String,
        keyPoints: [String],
        openQuestions: [String],
        generatedAtCommentCount: Number,
        generatedAt: Date,
      },
      default: null,
    },
  },
  { timestamps: true }
);

// Powers GET /api/forum/search
threadSchema.index({ title: 'text', body: 'text' });
threadSchema.index({ community: 1, createdAt: -1 });

threadSchema.methods.score = function () {
  return this.upvotes.length - this.downvotes.length;
};

/** `viewerId` lets the client render the viewer's own vote state. */
threadSchema.methods.toPublicJSON = function (viewerId) {
  const viewer = viewerId ? String(viewerId) : null;
  const author = this.populated('author') ? this.author : null;

  return {
    id: this._id,
    community: this.populated('community')
      ? { id: this.community._id, name: this.community.name, slug: this.community.slug }
      : this.community,
    author: author
      ? { id: author._id, name: author.name, role: author.role }
      : this.author,
    title: this.title,
    body: this.body,
    tags: this.tags,
    score: this.score(),
    myVote: !viewer
      ? 0
      : this.upvotes.some((id) => String(id) === viewer)
        ? 1
        : this.downvotes.some((id) => String(id) === viewer)
          ? -1
          : 0,
    bestAnswer: this.bestAnswer,
    commentCount: this.commentCount,
    locked: this.locked,
    // Only surface the summary if it still reflects the current comment count.
    summary:
      this.summary && this.summary.generatedAtCommentCount === this.commentCount
        ? {
            summary: this.summary.summary,
            keyPoints: this.summary.keyPoints,
            openQuestions: this.summary.openQuestions,
            generatedAt: this.summary.generatedAt,
          }
        : null,
    summaryStale: Boolean(
      this.summary && this.summary.generatedAtCommentCount !== this.commentCount
    ),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Thread', threadSchema);
