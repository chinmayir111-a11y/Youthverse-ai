const mongoose = require('mongoose');

/**
 * A bookmark on a library resource. Its own collection for the same reason
 * SavedOpportunity is: a widely-saved resource would otherwise grow an
 * unbounded array of user ids inside a document every reader has to load.
 */
const savedResourceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// One bookmark per person per resource; saving twice is a no-op, not an error.
savedResourceSchema.index({ user: 1, resource: 1 }, { unique: true });

module.exports = mongoose.model('SavedResource', savedResourceSchema);
