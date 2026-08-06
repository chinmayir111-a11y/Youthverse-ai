const mongoose = require('mongoose');

const STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'];

/**
 * Legal status moves, keyed by who is allowed to make them.
 *
 * Same shape as TRANSITIONS in models/MentorshipSession.js, and for the same
 * reason: "only the project owner can accept, only the requester can withdraw"
 * is visible in one place instead of being implied by the order of some
 * branches in the controller.
 */
const TRANSITIONS = {
  pending: {
    accepted: ['owner'],
    declined: ['owner'],
    withdrawn: ['requester'],
  },
  // Terminal. Accepting is what adds the requester to the project's team, so
  // reopening one of these would mean unwinding that too.
  accepted: {},
  declined: {},
  withdrawn: {},
};

const collaborationRequestSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which of the project's `rolesNeeded` they are answering. Free text rather
    // than an enum: the owner writes the roles, so the set is per-project.
    role: { type: String, default: '', maxlength: 120 },
    message: { type: String, required: true, maxlength: 2000 },

    status: { type: String, enum: STATUSES, default: 'pending', index: true },
    statusReason: { type: String, default: '', maxlength: 500 },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * One open ask per person per project.
 *
 * Partial rather than a plain unique index: a declined request should not
 * permanently bar someone from asking again a term later with more to show,
 * but two simultaneous open asks are just noise in the owner's inbox.
 */
collaborationRequestSchema.index(
  { project: 1, requester: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

const userRef = (value) =>
  value && value._id
    ? { id: value._id, name: value.name, role: value.role, avatarUrl: value.avatarUrl }
    : value;

collaborationRequestSchema.methods.toPublicJSON = function (viewer = {}) {
  const project =
    this.project && this.project._id
      ? { id: this.project._id, title: this.project.title, status: this.project.status }
      : this.project;

  return {
    id: this._id,
    project,
    requester: userRef(this.requester),
    role: this.role,
    message: this.message,
    status: this.status,
    statusReason: this.statusReason,
    decidedAt: this.decidedAt,
    createdAt: this.createdAt,
    // Which side of this request the viewer is on, resolved by the controller.
    mySide: viewer.mySide ?? null,
  };
};

module.exports = mongoose.model('CollaborationRequest', collaborationRequestSchema);
module.exports.STATUSES = STATUSES;
module.exports.TRANSITIONS = TRANSITIONS;
