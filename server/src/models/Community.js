const mongoose = require('mongoose');

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, default: '', maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    memberCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

communitySchema.statics.slugify = slugify;

communitySchema.methods.toPublicJSON = function (threadCount) {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    threadCount: threadCount ?? undefined,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Community', communitySchema);
