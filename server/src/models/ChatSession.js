const mongoose = require('mongoose');

const citationSchema = new mongoose.Schema(
  {
    page: { type: Number, default: null },
    quote: { type: String, default: '' },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    citations: { type: [citationSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One conversation about one document.
const chatSessionSchema = new mongoose.Schema(
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
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

chatSessionSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    document: this.document,
    messages: this.messages.map((m) => ({
      role: m.role,
      content: m.content,
      citations: m.citations,
      createdAt: m.createdAt,
    })),
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('ChatSession', chatSessionSchema);
