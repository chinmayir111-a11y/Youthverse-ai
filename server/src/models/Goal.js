const mongoose = require('mongoose');

// SRS Module 10 - Goal Tracking.
const CATEGORIES = ['study', 'career', 'project', 'skill', 'other'];
const STATUSES = ['active', 'achieved', 'paused', 'dropped'];

const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const goalSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    detail: { type: String, default: '', maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, default: 'other', index: true },

    targetDate: { type: Date, default: null },
    status: { type: String, enum: STATUSES, default: 'active', index: true },

    steps: { type: [stepSchema], default: [] },

    // Only consulted when there are no steps — see progressPercent() below.
    manualProgress: { type: Number, min: 0, max: 100, default: 0 },

    achievedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * Progress comes from the steps when there are any, and from the slider only
 * when there aren't.
 *
 * Storing both and showing whichever was written last would let a goal read
 * "80%" with four of five boxes unticked. Some goals genuinely have no natural
 * steps ("read 20 pages a day"), which is why the slider exists at all.
 */
goalSchema.methods.progressPercent = function () {
  if (this.steps.length === 0) return this.manualProgress;
  const done = this.steps.filter((s) => s.done).length;
  return Math.round((done / this.steps.length) * 100);
};

/** Past its target date and not finished. Null target means never overdue. */
goalSchema.methods.isOverdue = function () {
  if (!this.targetDate || this.status !== 'active') return false;
  return this.targetDate.getTime() < Date.now();
};

goalSchema.methods.toPublicJSON = function () {
  const daysLeft = this.targetDate
    ? Math.ceil((this.targetDate.getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    id: this._id,
    title: this.title,
    detail: this.detail,
    category: this.category,
    targetDate: this.targetDate,
    daysLeft,
    status: this.status,
    steps: this.steps.map((s) => ({ title: s.title, done: s.done })),
    manualProgress: this.manualProgress,
    // Derived, so the client never has to know which of the two rules applied.
    progress: this.progressPercent(),
    tracksSteps: this.steps.length > 0,
    overdue: this.isOverdue(),
    achievedAt: this.achievedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Goal', goalSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
