const mongoose = require('mongoose');

// SRS Module 7 - the seven categories the Opportunities Hub covers.
// Order matters: the UI renders filter tabs in this order.
const TYPES = [
  'internship',
  'scholarship',
  'hackathon',
  'competition',
  'workshop',
  'webinar',
  'event',
];

const opportunitySchema = new mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: { type: String, enum: TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    organisation: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 5000 },

    location: { type: String, default: '', maxlength: 120 },
    isRemote: { type: Boolean, default: false },

    // The apply/register page. Free-form rather than a strict URL: postings are
    // community-sourced and some point at an email address or a form code.
    link: { type: String, default: '', maxlength: 500 },

    tags: { type: [String], default: [], index: true },
    eligibility: { type: String, default: '', maxlength: 1000 },

    // Deliberately a string. A stipend, a scholarship amount, and a prize pool
    // are not the same quantity, and forcing them into one number would mean
    // inventing a currency and a period that the source posting never stated.
    reward: { type: String, default: '', maxlength: 120 },

    // `deadline` is when applications close; `startsAt` is when the thing
    // happens. An internship has the first, a webinar mostly the second.
    deadline: { type: Date, default: null, index: true },
    startsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Free-text search over the fields people actually search by.
opportunitySchema.index({ title: 'text', organisation: 'text', description: 'text' });

/** Closed once the deadline has passed. No deadline means it never closes. */
opportunitySchema.methods.isExpired = function () {
  return Boolean(this.deadline && this.deadline.getTime() < Date.now());
};

opportunitySchema.methods.toPublicJSON = function (viewer = {}) {
  const postedBy =
    this.postedBy && this.postedBy._id
      ? { id: this.postedBy._id, name: this.postedBy.name, role: this.postedBy.role }
      : this.postedBy;

  const daysLeft = this.deadline
    ? Math.ceil((this.deadline.getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    id: this._id,
    postedBy,
    type: this.type,
    title: this.title,
    organisation: this.organisation,
    description: this.description,
    location: this.location,
    isRemote: this.isRemote,
    link: this.link,
    tags: this.tags,
    eligibility: this.eligibility,
    reward: this.reward,
    deadline: this.deadline,
    startsAt: this.startsAt,
    expired: this.isExpired(),
    daysLeft,
    createdAt: this.createdAt,
    // Viewer-specific state, resolved by the controller rather than stored here.
    saved: Boolean(viewer.saved),
    tracked: Boolean(viewer.tracked),
    canManage: Boolean(viewer.canManage),
  };
};

module.exports = mongoose.model('Opportunity', opportunitySchema);
module.exports.TYPES = TYPES;
