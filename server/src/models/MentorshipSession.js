const mongoose = require('mongoose');

const STATUSES = ['requested', 'confirmed', 'declined', 'cancelled', 'completed'];

/**
 * Legal status moves, keyed by who is allowed to make them.
 *
 * Kept as data rather than a pile of ifs in the controller: the rule "a mentee
 * cannot mark their own session complete" is then visible in one place instead
 * of being implied by the order of some branches.
 */
const TRANSITIONS = {
  requested: {
    confirmed: ['mentor'],
    declined: ['mentor'],
    cancelled: ['mentee', 'mentor'],
  },
  confirmed: {
    cancelled: ['mentee', 'mentor'],
    completed: ['mentor'],
  },
  // Terminal.
  declined: {},
  cancelled: {},
  completed: {},
};

const mentorshipSessionSchema = new mongoose.Schema(
  {
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
      index: true,
    },

    topic: { type: String, required: true, trim: true, maxlength: 200 },
    agenda: { type: String, default: '', maxlength: 2000 },

    scheduledFor: { type: Date, required: true },
    durationMinutes: { type: Number, min: 15, max: 120, default: 30 },

    status: { type: String, enum: STATUSES, default: 'requested', index: true },
    statusReason: { type: String, default: '', maxlength: 500 },

    // SRS lists video meetings as a later version; the field exists so a mentor
    // can paste their own link today without the model changing later.
    meetingLink: { type: String, default: '', maxlength: 500 },

    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Collision checks always look up a mentor's sessions in a time window.
mentorshipSessionSchema.index({ mentor: 1, scheduledFor: 1 });

mentorshipSessionSchema.methods.endsAt = function () {
  return new Date(this.scheduledFor.getTime() + this.durationMinutes * 60_000);
};

const userRef = (value) =>
  value && value._id
    ? { id: value._id, name: value.name, role: value.role, avatarUrl: value.avatarUrl }
    : value;

mentorshipSessionSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    mentor: userRef(this.mentor),
    mentee: userRef(this.mentee),
    topic: this.topic,
    agenda: this.agenda,
    scheduledFor: this.scheduledFor,
    durationMinutes: this.durationMinutes,
    endsAt: this.endsAt(),
    status: this.status,
    statusReason: this.statusReason,
    meetingLink: this.meetingLink,
    completedAt: this.completedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('MentorshipSession', mentorshipSessionSchema);
module.exports.STATUSES = STATUSES;
module.exports.TRANSITIONS = TRANSITIONS;
