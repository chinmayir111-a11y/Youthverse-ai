const mongoose = require('mongoose');

// SRS Module 4 - Resume Builder. One resume per user; revisions are out of scope.

const sub = (fields) => new mongoose.Schema(fields, { _id: false });

const educationSchema = sub({
  institution: { type: String, default: '', maxlength: 160 },
  qualification: { type: String, default: '', maxlength: 160 },
  startYear: { type: Number, default: null },
  endYear: { type: Number, default: null },
  grade: { type: String, default: '', maxlength: 60 },
});

const experienceSchema = sub({
  organisation: { type: String, default: '', maxlength: 160 },
  title: { type: String, default: '', maxlength: 160 },
  startDate: { type: String, default: '', maxlength: 40 },
  endDate: { type: String, default: '', maxlength: 40 },
  bullets: { type: [String], default: [] },
});

const projectSchema = sub({
  name: { type: String, default: '', maxlength: 160 },
  link: { type: String, default: '', maxlength: 300 },
  tech: { type: [String], default: [] },
  bullets: { type: [String], default: [] },
});

const resumeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    fullName: { type: String, default: '', maxlength: 120 },
    headline: { type: String, default: '', maxlength: 160 },
    email: { type: String, default: '', maxlength: 160 },
    phone: { type: String, default: '', maxlength: 40 },
    location: { type: String, default: '', maxlength: 120 },
    links: { type: [String], default: [] },

    summary: { type: String, default: '', maxlength: 1200 },
    education: { type: [educationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    skills: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    achievements: { type: [String], default: [] },
  },
  { timestamps: true }
);

resumeSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    fullName: this.fullName,
    headline: this.headline,
    email: this.email,
    phone: this.phone,
    location: this.location,
    links: this.links,
    summary: this.summary,
    education: this.education,
    experience: this.experience,
    projects: this.projects,
    skills: this.skills,
    certifications: this.certifications,
    achievements: this.achievements,
    updatedAt: this.updatedAt,
  };
};

/**
 * Flatten the resume to the plain text an ATS would actually see.
 * The analyser grades this string, so what the model reads is exactly what a
 * parser would extract — not a prettier JSON version of it.
 */
resumeSchema.methods.toPlainText = function () {
  const lines = [];
  const push = (...parts) => lines.push(parts.filter(Boolean).join(' | '));

  push(this.fullName, this.headline);
  push(this.email, this.phone, this.location);
  if (this.links.length) push(this.links.join(' '));

  if (this.summary) lines.push('', 'SUMMARY', this.summary);

  if (this.education.length) {
    lines.push('', 'EDUCATION');
    for (const e of this.education) {
      push(e.qualification, e.institution, [e.startYear, e.endYear].filter(Boolean).join('-'), e.grade);
    }
  }

  if (this.experience.length) {
    lines.push('', 'EXPERIENCE');
    for (const x of this.experience) {
      push(x.title, x.organisation, [x.startDate, x.endDate].filter(Boolean).join(' - '));
      for (const b of x.bullets) lines.push(`- ${b}`);
    }
  }

  if (this.projects.length) {
    lines.push('', 'PROJECTS');
    for (const p of this.projects) {
      push(p.name, p.tech.join(', '), p.link);
      for (const b of p.bullets) lines.push(`- ${b}`);
    }
  }

  if (this.skills.length) lines.push('', 'SKILLS', this.skills.join(', '));
  if (this.certifications.length) lines.push('', 'CERTIFICATIONS', this.certifications.join(', '));
  if (this.achievements.length) {
    lines.push('', 'ACHIEVEMENTS');
    for (const a of this.achievements) lines.push(`- ${a}`);
  }

  return lines.join('\n').trim();
};

module.exports = mongoose.model('Resume', resumeSchema);
