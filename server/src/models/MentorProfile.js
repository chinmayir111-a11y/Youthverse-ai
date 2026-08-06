const mongoose = require('mongoose');

/**
 * SRS Module 6 - the public listing a mentor puts up.
 *
 * Separate from Profile because the two answer different questions: Profile is
 * "who is this student", this is "what would you come to this person for". A
 * mentor has both.
 */

// A weekly recurring window, e.g. Tuesdays 18:00-21:00. Times are stored as
// "HH:MM" strings in the server's local zone — sufficient for a single-campus
// deployment, and the thing to revisit before this crosses time zones.
const availabilitySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const mentorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    headline: { type: String, default: '', maxlength: 160 },
    bio: { type: String, default: '', maxlength: 2000 },
    expertise: { type: [String], default: [], index: true },
    languages: { type: [String], default: [] },
    yearsExperience: { type: Number, min: 0, max: 60, default: 0 },
    currentRole: { type: String, default: '', maxlength: 160 },
    organisation: { type: String, default: '', maxlength: 160 },

    sessionLengthMinutes: { type: Number, enum: [15, 30, 45, 60], default: 30 },
    availability: { type: [availabilitySchema], default: [] },

    // Listed publicly only when both are true: published is the mentor's own
    // switch, acceptingMentees pauses new bookings without unlisting the page.
    isPublished: { type: Boolean, default: false, index: true },
    acceptingMentees: { type: Boolean, default: true },

    // Denormalised from MentorReview so the browse list doesn't need to
    // aggregate over every review to sort by rating. Recomputed from source on
    // every review write rather than incremented, so it can't drift.
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedSessions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

mentorProfileSchema.methods.toPublicJSON = function () {
  // `user` is populated on reads and a bare id elsewhere; surface both shapes
  // the same way the forum does for authors.
  const user =
    this.user && this.user._id
      ? { id: this.user._id, name: this.user.name, role: this.user.role, avatarUrl: this.user.avatarUrl }
      : this.user;

  return {
    id: this._id,
    user,
    headline: this.headline,
    bio: this.bio,
    expertise: this.expertise,
    languages: this.languages,
    yearsExperience: this.yearsExperience,
    currentRole: this.currentRole,
    organisation: this.organisation,
    sessionLengthMinutes: this.sessionLengthMinutes,
    availability: this.availability,
    isPublished: this.isPublished,
    acceptingMentees: this.acceptingMentees,
    ratingAverage: this.ratingAverage,
    ratingCount: this.ratingCount,
    completedSessions: this.completedSessions,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('MentorProfile', mentorProfileSchema);
