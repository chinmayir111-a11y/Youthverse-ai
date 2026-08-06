const mongoose = require('mongoose');

// A PDF the student uploaded, plus the provider-side file handle we chat against.
const documentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    originalName: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    pageCount: { type: Number, default: null },

    // Handle returned by the AI provider's Files API.
    providerFileId: { type: String, required: true },
    provider: { type: String, required: true },
  },
  { timestamps: true }
);

documentSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    title: this.title,
    originalName: this.originalName,
    sizeBytes: this.sizeBytes,
    pageCount: this.pageCount,
    provider: this.provider,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Document', documentSchema);
