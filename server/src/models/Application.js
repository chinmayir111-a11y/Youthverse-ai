const mongoose = require('mongoose');

// SRS Module 4 - Placement Tracker.
// Stages are ordered: the UI renders them as columns in this order.
const STAGES = ['wishlist', 'applied', 'assessment', 'interview', 'offer', 'rejected'];

const applicationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, default: '', maxlength: 120 },
    link: { type: String, default: '', maxlength: 500 },
    stage: { type: String, enum: STAGES, default: 'wishlist', index: true },
    appliedOn: { type: Date, default: null },
    nextStepOn: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true }
);

applicationSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    company: this.company,
    role: this.role,
    location: this.location,
    link: this.link,
    stage: this.stage,
    appliedOn: this.appliedOn,
    nextStepOn: this.nextStepOn,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Application', applicationSchema);
module.exports.STAGES = STAGES;
