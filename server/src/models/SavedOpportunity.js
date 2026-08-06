const mongoose = require('mongoose');

/**
 * A bookmark. Kept as its own collection rather than an array of user ids on
 * Opportunity: a popular posting would otherwise grow an unbounded array inside
 * the document every reader has to load.
 */
const savedOpportunitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// One bookmark per person per posting; saving twice is a no-op, not a duplicate.
savedOpportunitySchema.index({ user: 1, opportunity: 1 }, { unique: true });

module.exports = mongoose.model('SavedOpportunity', savedOpportunitySchema);
