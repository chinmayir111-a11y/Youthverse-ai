const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    category: { type: String, default: '' },
    whatGoodLooksLike: { type: String, default: '' },
    answer: { type: String, default: '' },
    answeredAt: { type: Date, default: null },
  },
  { _id: false }
);

// SRS Module 4 - Mock Interviews. One session = one set of questions, the
// student's answers to them, and a single grading pass over the whole set.
const interviewSessionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: { type: String, required: true, maxlength: 160 },
    level: {
      type: String,
      enum: ['intern', 'entry', 'junior', 'mid'],
      default: 'entry',
    },
    focus: { type: String, default: '', maxlength: 200 },
    questions: { type: [questionSchema], default: [] },
    feedback: { type: mongoose.Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

interviewSessionSchema.methods.toPublicJSON = function () {
  const answered = this.questions.filter((q) => q.answer && q.answer.trim()).length;
  return {
    id: this._id,
    role: this.role,
    level: this.level,
    focus: this.focus,
    questions: this.questions.map((q) => ({
      prompt: q.prompt,
      category: q.category,
      whatGoodLooksLike: q.whatGoodLooksLike,
      answer: q.answer,
    })),
    answeredCount: answered,
    feedback: this.feedback,
    // Derived rather than stored: a session is done once it has been graded,
    // and storing a status alongside `feedback` would let the two disagree.
    status: this.feedback ? 'graded' : 'in_progress',
    completedAt: this.completedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
