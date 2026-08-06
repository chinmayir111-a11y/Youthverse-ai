const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * The AI Career Guidance conversation — one running thread per student.
 *
 * Deliberately separate from ChatSession: that one is anchored to an uploaded
 * document and carries citations, neither of which apply here. Widening it to
 * cover both would have made `document` optional on a model where it is the
 * whole point.
 */
const careerChatSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

careerChatSessionSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    messages: this.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('CareerChatSession', careerChatSessionSchema);
