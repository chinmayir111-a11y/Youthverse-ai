const mongoose = require('mongoose');

// SRS Module 8 - Project Marketplace.
// Order matters: the UI renders filter tabs in this order, and it reads as the
// life of a project from first idea to something people can use.
const STATUSES = ['idea', 'building', 'beta', 'shipped'];

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    tagline: { type: String, default: '', maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },

    status: { type: String, enum: STATUSES, default: 'building', index: true },

    // Free-form rather than a strict URL. A project may live on GitLab, a
    // college server, or nowhere yet — rejecting those would push people to
    // paste a fake github.com link just to get past validation.
    repoUrl: { type: String, default: '', maxlength: 500 },
    demoUrl: { type: String, default: '', maxlength: 500 },

    // `tech` is what it is built with; `tags` is what it is about. Kept apart
    // because "React" and "climate" are not the same kind of filter, and
    // browsing by one while ignoring the other is the common case.
    tech: { type: [String], default: [], index: true },
    tags: { type: [String], default: [], index: true },

    // SRS "Find Teammates". `rolesNeeded` is what the project is missing, which
    // is the thing a browsing student actually matches themselves against.
    lookingForTeammates: { type: Boolean, default: false, index: true },
    rolesNeeded: { type: [String], default: [] },

    // A small, bounded array — a student team, not an audience. Contrast with
    // bookmarks in the Opportunities Hub, which are their own collection
    // precisely because they are unbounded.
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Cached aggregates over ProjectReview. Recomputed on every review write,
    // never incremented, so a failed write cannot leave them permanently wrong.
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Free-text search over the fields people actually search by.
projectSchema.index({ title: 'text', tagline: 'text', description: 'text' });

const userRef = (value) =>
  value && value._id
    ? { id: value._id, name: value.name, role: value.role, avatarUrl: value.avatarUrl }
    : value;

projectSchema.methods.toPublicJSON = function (viewer = {}) {
  return {
    id: this._id,
    owner: userRef(this.owner),
    title: this.title,
    tagline: this.tagline,
    description: this.description,
    status: this.status,
    repoUrl: this.repoUrl,
    demoUrl: this.demoUrl,
    tech: this.tech,
    tags: this.tags,
    lookingForTeammates: this.lookingForTeammates,
    rolesNeeded: this.rolesNeeded,
    collaborators: (this.collaborators ?? []).map(userRef),
    ratingAverage: this.ratingAverage,
    ratingCount: this.ratingCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    // Viewer-specific state, resolved by the controller rather than stored here.
    canManage: Boolean(viewer.canManage),
    isCollaborator: Boolean(viewer.isCollaborator),
    myRating: viewer.myRating ?? null,
    myRequestStatus: viewer.myRequestStatus ?? null,
  };
};

module.exports = mongoose.model('Project', projectSchema);
module.exports.STATUSES = STATUSES;
