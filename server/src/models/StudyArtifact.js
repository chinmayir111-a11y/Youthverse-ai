const mongoose = require('mongoose');

/**
 * A generated study aid (quiz, flashcard deck, or notes) tied to a document.
 *
 * `payload` is Mixed because each kind has a different shape, and the shape is
 * already pinned by the Zod schema in ai/schemas.js at generation time —
 * duplicating it as three Mongoose sub-schemas would just be a second place to
 * keep in sync.
 */
const studyArtifactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['quiz', 'flashcards', 'notes'],
      required: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

studyArtifactSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    document: this.document,
    kind: this.kind,
    payload: this.payload,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('StudyArtifact', studyArtifactSchema);
