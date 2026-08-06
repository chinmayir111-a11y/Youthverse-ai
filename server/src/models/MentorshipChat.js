const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 5000 },
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * SRS Module 6 - Chat. One thread per pair of people, forever.
 *
 * `key` is the two user ids sorted and joined. A unique index on it is what
 * actually prevents two threads for the same pair — an index on the array
 * would not, since [a,b] and [b,a] are different arrays.
 */
const mentorshipChatSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      index: true,
    },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** The canonical key for a pair, order-independent. */
mentorshipChatSchema.statics.keyFor = (a, b) =>
  [String(a), String(b)].sort().join(':');

const userRef = (value) =>
  value && value._id
    ? { id: value._id, name: value.name, role: value.role, avatarUrl: value.avatarUrl }
    : value;

mentorshipChatSchema.methods.toPublicJSON = function (viewerId) {
  const viewer = String(viewerId);
  return {
    id: this._id,
    participants: this.participants.map(userRef),
    messages: this.messages.map((m) => ({
      sender: userRef(m.sender),
      body: m.body,
      mine: String(m.sender?._id ?? m.sender) === viewer,
      createdAt: m.createdAt,
    })),
    lastMessageAt: this.lastMessageAt,
    unreadCount: this.messages.filter(
      (m) => String(m.sender?._id ?? m.sender) !== viewer && !m.readBy.some((id) => String(id) === viewer)
    ).length,
  };
};

module.exports = mongoose.model('MentorshipChat', mentorshipChatSchema);
