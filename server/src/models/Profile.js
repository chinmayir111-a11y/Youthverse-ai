const mongoose = require('mongoose');

// SRS Module 2 - User Profile.
// GitHub/LinkedIn are stored as URLs only; OAuth integration is a later phase.
const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Personal
    bio: { type: String, default: '', maxlength: 500 },
    location: { type: String, default: '', maxlength: 100 },

    // Academic
    educationLevel: {
      type: String,
      enum: ['school', 'diploma', 'undergraduate', 'postgraduate', 'other', ''],
      default: '',
    },
    institution: { type: String, default: '', maxlength: 120 },
    fieldOfStudy: { type: String, default: '', maxlength: 120 },
    graduationYear: {
      type: Number,
      min: 1950,
      max: 2100,
      default: null,
    },

    // Growth
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    goals: { type: [String], default: [] },

    // Links
    githubUrl: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    portfolioUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

profileSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    user: this.user,
    bio: this.bio,
    location: this.location,
    educationLevel: this.educationLevel,
    institution: this.institution,
    fieldOfStudy: this.fieldOfStudy,
    graduationYear: this.graduationYear,
    skills: this.skills,
    interests: this.interests,
    goals: this.goals,
    githubUrl: this.githubUrl,
    linkedinUrl: this.linkedinUrl,
    portfolioUrl: this.portfolioUrl,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Profile', profileSchema);
