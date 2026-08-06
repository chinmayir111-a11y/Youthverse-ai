const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const CareerArtifact = require('../models/CareerArtifact');
const InterviewSession = require('../models/InterviewSession');
const Application = require('../models/Application');
const CareerChatSession = require('../models/CareerChatSession');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const normalizeTags = require('../utils/normalizeTags');
const { getProvider } = require('../ai');

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const requireText = (value, field, max = 2000) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new ApiError(400, `${field} is required`);
  return text.slice(0, max);
};

/** The student's profile rendered as the context every career tool works from. */
const profileContext = async (user) => {
  const profile = await Profile.findOne({ user: user._id });
  const lines = [`Name: ${user.name}`];
  if (!profile) {
    lines.push('(This student has not filled in their profile yet.)');
    return lines.join('\n');
  }

  const add = (label, value) => {
    if (Array.isArray(value) ? value.length : value) {
      lines.push(`${label}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }
  };

  add('Education level', profile.educationLevel);
  add('Institution', profile.institution);
  add('Field of study', profile.fieldOfStudy);
  add('Graduating', profile.graduationYear);
  add('Location', profile.location);
  add('Skills', profile.skills);
  add('Interests', profile.interests);
  add('Goals', profile.goals);
  add('Bio', profile.bio);

  if (lines.length === 1) lines.push('(Profile exists but is empty.)');
  return lines.join('\n');
};

const ownedArtifact = async (id, userId) => {
  const artifact = await CareerArtifact.findOne({ _id: id, owner: userId });
  if (!artifact) throw new ApiError(404, 'Not found');
  return artifact;
};

// ---------------------------------------------------------------------------
// Resume Builder
// ---------------------------------------------------------------------------

/** Fields the resume editor is allowed to write. */
const RESUME_FIELDS = [
  'fullName',
  'headline',
  'email',
  'phone',
  'location',
  'links',
  'summary',
  'education',
  'experience',
  'projects',
  'skills',
  'certifications',
  'achievements',
];


// GET /api/career/resume
const getResume = asyncHandler(async (req, res) => {
  let resume = await Resume.findOne({ owner: req.user._id });

  if (!resume) {
    // Seed the first draft from the profile so the editor is never a blank page.
    const profile = await Profile.findOne({ user: req.user._id });
    resume = await Resume.create({
      owner: req.user._id,
      fullName: req.user.name,
      email: req.user.email,
      location: profile?.location || '',
      summary: profile?.bio || '',
      skills: profile?.skills || [],
      links: [profile?.githubUrl, profile?.linkedinUrl, profile?.portfolioUrl].filter(Boolean),
      education: profile?.institution
        ? [
            {
              institution: profile.institution,
              qualification: profile.fieldOfStudy || '',
              endYear: profile.graduationYear || null,
            },
          ]
        : [],
    });
  }

  res.json({ success: true, data: { resume: resume.toPublicJSON() } });
});

// PUT /api/career/resume
const updateResume = asyncHandler(async (req, res) => {
  const updates = {};

  for (const field of RESUME_FIELDS) {
    if (!(field in req.body)) continue;
    const value = req.body[field];

    if (['links', 'skills', 'certifications', 'achievements'].includes(field)) {
      updates[field] = normalizeTags(value) ?? [];
    } else if (['education', 'experience', 'projects'].includes(field)) {
      // Mongoose casts and trims these against the sub-schemas; all we enforce
      // here is that a list arrived and that it can't grow without bound.
      if (!Array.isArray(value)) throw new ApiError(400, `${field} must be an array`);
      updates[field] = value.slice(0, 30);
    } else {
      updates[field] = typeof value === 'string' ? value.trim() : '';
    }
  }

  const resume = await Resume.findOneAndUpdate({ owner: req.user._id }, updates, {
    new: true,
    runValidators: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  res.json({ success: true, message: 'Resume saved', data: { resume: resume.toPublicJSON() } });
});

// POST /api/career/resume/ats
const analyzeResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ owner: req.user._id });
  const resumeText = resume?.toPlainText() || '';
  if (!resumeText) {
    throw new ApiError(400, 'Fill in your resume before running an ATS check.');
  }

  const jobDescription =
    typeof req.body.jobDescription === 'string' ? req.body.jobDescription.trim().slice(0, 8000) : '';
  const targetRole =
    typeof req.body.targetRole === 'string' ? req.body.targetRole.trim().slice(0, 160) : '';

  const payload = await getProvider().analyzeResume({ resumeText, jobDescription, targetRole });

  const artifact = await CareerArtifact.create({
    owner: req.user._id,
    kind: 'ats',
    title: targetRole ? `ATS check — ${targetRole}` : 'ATS check',
    // The job description is kept so a stale report can be read in context, but
    // truncated: this is a saved snapshot, not a second copy of the posting.
    input: { targetRole, jobDescription: jobDescription.slice(0, 2000) },
    payload,
  });

  res.status(201).json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// ---------------------------------------------------------------------------
// Skill gap / roadmap / company prep
// ---------------------------------------------------------------------------

// POST /api/career/skill-gap
const skillGap = asyncHandler(async (req, res) => {
  const targetRole = requireText(req.body.targetRole, 'A target role', 160);
  const payload = await getProvider().analyzeSkillGap({
    targetRole,
    profileText: await profileContext(req.user),
  });

  const artifact = await CareerArtifact.create({
    owner: req.user._id,
    kind: 'skill_gap',
    title: `Skill gap — ${targetRole}`,
    input: { targetRole },
    payload,
  });

  res.status(201).json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// POST /api/career/roadmap
const roadmap = asyncHandler(async (req, res) => {
  const goal = requireText(req.body.goal, 'A goal', 200);
  const weeks = clamp(req.body.weeks, 2, 52, 12);
  const hoursPerWeek = clamp(req.body.hoursPerWeek, 1, 60, 8);

  const payload = await getProvider().generateRoadmap({
    goal,
    weeks,
    hoursPerWeek,
    profileText: await profileContext(req.user),
  });

  const artifact = await CareerArtifact.create({
    owner: req.user._id,
    kind: 'roadmap',
    title: payload.title || `Roadmap — ${goal}`,
    input: { goal, weeks, hoursPerWeek },
    payload,
  });

  res.status(201).json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// POST /api/career/company-prep
const companyPrep = asyncHandler(async (req, res) => {
  const company = requireText(req.body.company, 'A company', 120);
  const role = requireText(req.body.role, 'A role', 160);

  const payload = await getProvider().generateCompanyPrep({ company, role });

  const artifact = await CareerArtifact.create({
    owner: req.user._id,
    kind: 'company_prep',
    title: `${company} — ${role}`,
    input: { company, role },
    payload,
  });

  res.status(201).json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// GET /api/career/artifacts?kind=
const listArtifacts = asyncHandler(async (req, res) => {
  const query = { owner: req.user._id };
  if (req.query.kind) {
    if (!CareerArtifact.KINDS.includes(req.query.kind)) {
      throw new ApiError(400, `Unknown artifact kind "${req.query.kind}"`);
    }
    query.kind = req.query.kind;
  }

  const artifacts = await CareerArtifact.find(query).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: { artifacts: artifacts.map((a) => a.toPublicJSON()) } });
});

// GET /api/career/artifacts/:id
const getArtifact = asyncHandler(async (req, res) => {
  const artifact = await ownedArtifact(req.params.id, req.user._id);
  res.json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// DELETE /api/career/artifacts/:id
const deleteArtifact = asyncHandler(async (req, res) => {
  const artifact = await ownedArtifact(req.params.id, req.user._id);
  await artifact.deleteOne();
  res.json({ success: true, message: 'Deleted' });
});

// PATCH /api/career/artifacts/:id/milestones
const setMilestone = asyncHandler(async (req, res) => {
  const artifact = await ownedArtifact(req.params.id, req.user._id);
  if (artifact.kind !== 'roadmap') {
    throw new ApiError(400, 'Only roadmaps have milestones');
  }

  const { milestoneId, done } = req.body;
  if (typeof milestoneId !== 'string' || !/^\d+\.\d+$/.test(milestoneId)) {
    throw new ApiError(400, 'milestoneId must look like "<phase>.<milestone>"');
  }

  // Reject ids that don't address a real milestone, so a typo can't silently
  // accumulate dead keys that the progress bar then counts.
  const [phaseIndex, milestoneIndex] = milestoneId.split('.').map(Number);
  const phase = artifact.payload?.phases?.[phaseIndex];
  if (!phase || !phase.milestones?.[milestoneIndex]) {
    throw new ApiError(404, 'No such milestone in this roadmap');
  }

  const set = new Set(artifact.completedMilestones);
  if (done === false) set.delete(milestoneId);
  else set.add(milestoneId);

  artifact.completedMilestones = [...set];
  await artifact.save();

  res.json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// ---------------------------------------------------------------------------
// Mock interviews
// ---------------------------------------------------------------------------

// POST /api/career/interviews
const startInterview = asyncHandler(async (req, res) => {
  const role = requireText(req.body.role, 'A role', 160);
  const level = ['intern', 'entry', 'junior', 'mid'].includes(req.body.level)
    ? req.body.level
    : 'entry';
  const focus = typeof req.body.focus === 'string' ? req.body.focus.trim().slice(0, 200) : '';
  const count = clamp(req.body.count, 3, 10, 5);

  const { questions } = await getProvider().generateInterviewQuestions({
    role,
    level,
    focus,
    count,
  });

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ApiError(502, 'The AI returned no interview questions. Try again.');
  }

  const session = await InterviewSession.create({
    owner: req.user._id,
    role,
    level,
    focus,
    questions: questions.map((q) => ({
      prompt: q.prompt,
      category: q.category,
      whatGoodLooksLike: q.whatGoodLooksLike,
    })),
  });

  res.status(201).json({ success: true, data: { session: session.toPublicJSON() } });
});

const ownedSession = async (id, userId) => {
  const session = await InterviewSession.findOne({ _id: id, owner: userId });
  if (!session) throw new ApiError(404, 'Interview not found');
  return session;
};

// GET /api/career/interviews
const listInterviews = asyncHandler(async (req, res) => {
  const sessions = await InterviewSession.find({ owner: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30);
  res.json({ success: true, data: { sessions: sessions.map((s) => s.toPublicJSON()) } });
});

// GET /api/career/interviews/:id
const getInterview = asyncHandler(async (req, res) => {
  const session = await ownedSession(req.params.id, req.user._id);
  res.json({ success: true, data: { session: session.toPublicJSON() } });
});

// PUT /api/career/interviews/:id/answers
const saveAnswers = asyncHandler(async (req, res) => {
  const session = await ownedSession(req.params.id, req.user._id);
  if (session.feedback) {
    throw new ApiError(409, 'This interview has already been graded.');
  }

  const { answers } = req.body;
  if (!Array.isArray(answers)) throw new ApiError(400, 'answers must be an array');

  for (const entry of answers) {
    const index = Number(entry?.index);
    if (!Number.isInteger(index) || index < 0 || index >= session.questions.length) continue;
    const text = typeof entry.answer === 'string' ? entry.answer.slice(0, 5000) : '';
    session.questions[index].answer = text;
    session.questions[index].answeredAt = text.trim() ? new Date() : null;
  }

  await session.save();
  res.json({ success: true, data: { session: session.toPublicJSON() } });
});

// POST /api/career/interviews/:id/feedback
const gradeInterview = asyncHandler(async (req, res) => {
  const session = await ownedSession(req.params.id, req.user._id);

  if (!session.questions.some((q) => q.answer && q.answer.trim())) {
    throw new ApiError(400, 'Answer at least one question before asking for feedback.');
  }

  const feedback = await getProvider().gradeInterview({
    role: session.role,
    level: session.level,
    questions: session.questions.map((q) => ({
      prompt: q.prompt,
      category: q.category,
      whatGoodLooksLike: q.whatGoodLooksLike,
      answer: q.answer,
    })),
  });

  session.feedback = feedback;
  session.completedAt = new Date();
  await session.save();

  res.json({ success: true, data: { session: session.toPublicJSON() } });
});

// DELETE /api/career/interviews/:id
const deleteInterview = asyncHandler(async (req, res) => {
  const session = await ownedSession(req.params.id, req.user._id);
  await session.deleteOne();
  res.json({ success: true, message: 'Interview deleted' });
});

// ---------------------------------------------------------------------------
// Placement tracker
// ---------------------------------------------------------------------------

const APPLICATION_FIELDS = [
  'company',
  'role',
  'location',
  'link',
  'stage',
  'appliedOn',
  'nextStepOn',
  'notes',
];

const applicationUpdates = (body) => {
  const updates = {};
  for (const field of APPLICATION_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];

    if (field === 'stage') {
      if (!Application.STAGES.includes(value)) {
        throw new ApiError(400, `stage must be one of: ${Application.STAGES.join(', ')}`);
      }
      updates.stage = value;
    } else if (field === 'appliedOn' || field === 'nextStepOn') {
      if (value === null || value === '') {
        updates[field] = null;
      } else {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} is not a valid date`);
        updates[field] = date;
      }
    } else {
      updates[field] = typeof value === 'string' ? value.trim() : '';
    }
  }
  return updates;
};

// GET /api/career/applications
const listApplications = asyncHandler(async (req, res) => {
  const applications = await Application.find({ owner: req.user._id }).sort({ updatedAt: -1 });
  res.json({
    success: true,
    data: {
      applications: applications.map((a) => a.toPublicJSON()),
      stages: Application.STAGES,
    },
  });
});

// POST /api/career/applications
const createApplication = asyncHandler(async (req, res) => {
  const updates = applicationUpdates(req.body);
  if (!updates.company) throw new ApiError(400, 'A company is required');
  if (!updates.role) throw new ApiError(400, 'A role is required');

  const application = await Application.create({ owner: req.user._id, ...updates });
  res.status(201).json({ success: true, data: { application: application.toPublicJSON() } });
});

// PATCH /api/career/applications/:id
const updateApplication = asyncHandler(async (req, res) => {
  const updates = applicationUpdates(req.body);
  if ('company' in updates && !updates.company) throw new ApiError(400, 'A company is required');
  if ('role' in updates && !updates.role) throw new ApiError(400, 'A role is required');

  const application = await Application.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!application) throw new ApiError(404, 'Application not found');

  res.json({ success: true, data: { application: application.toPublicJSON() } });
});

// DELETE /api/career/applications/:id
const deleteApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOneAndDelete({
    _id: req.params.id,
    owner: req.user._id,
  });
  if (!application) throw new ApiError(404, 'Application not found');
  res.json({ success: true, message: 'Application removed' });
});

// ---------------------------------------------------------------------------
// AI career guidance (streaming)
// ---------------------------------------------------------------------------

// GET /api/career/guidance
const getGuidanceSession = asyncHandler(async (req, res) => {
  let session = await CareerChatSession.findOne({ owner: req.user._id });
  if (!session) session = await CareerChatSession.create({ owner: req.user._id });
  res.json({ success: true, data: { session: session.toPublicJSON() } });
});

// POST /api/career/guidance  — Server-Sent Events, same shape as study chat.
const sendGuidanceMessage = asyncHandler(async (req, res) => {
  const question = requireText(req.body.question, 'A question', 4000);

  let session = await CareerChatSession.findOne({ owner: req.user._id });
  if (!session) session = await CareerChatSession.create({ owner: req.user._id });

  const history = session.messages.map((m) => ({ role: m.role, content: m.content }));
  const profileText = await profileContext(req.user);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await getProvider().careerChat({
      profileText,
      history,
      question,
      onDelta: (text) => send('delta', { text }),
    });

    session.messages.push({ role: 'user', content: question });
    session.messages.push({ role: 'assistant', content: result.text });
    await session.save();

    send('done', { text: result.text, usage: result.usage });
  } catch (error) {
    console.error('[career] guidance failed:', error.message);
    send('error', {
      message: error.statusCode ? error.message : 'The AI request failed. Please try again.',
    });
  } finally {
    res.end();
  }
});

// DELETE /api/career/guidance
const clearGuidance = asyncHandler(async (req, res) => {
  await CareerChatSession.findOneAndUpdate({ owner: req.user._id }, { messages: [] });
  res.json({ success: true, message: 'Conversation cleared' });
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

// GET /api/career/overview  — the numbers the Career Hub landing page shows.
const getOverview = asyncHandler(async (req, res) => {
  const [resume, artifacts, interviews, applications] = await Promise.all([
    Resume.findOne({ owner: req.user._id }),
    CareerArtifact.find({ owner: req.user._id }).select('kind').lean(),
    InterviewSession.find({ owner: req.user._id }).select('feedback').lean(),
    Application.find({ owner: req.user._id }).select('stage').lean(),
  ]);

  const byStage = Object.fromEntries(Application.STAGES.map((s) => [s, 0]));
  for (const a of applications) byStage[a.stage] = (byStage[a.stage] || 0) + 1;

  const byKind = {};
  for (const a of artifacts) byKind[a.kind] = (byKind[a.kind] || 0) + 1;

  // Which resume sections have any content — drives the "resume strength" bar.
  const sections = resume
    ? {
        contact: Boolean(resume.fullName && resume.email),
        summary: Boolean(resume.summary),
        education: resume.education.length > 0,
        experience: resume.experience.length > 0,
        projects: resume.projects.length > 0,
        skills: resume.skills.length > 0,
      }
    : null;

  const filled = sections ? Object.values(sections).filter(Boolean).length : 0;

  res.json({
    success: true,
    data: {
      resume: {
        exists: Boolean(resume),
        sections,
        completion: sections ? Math.round((filled / Object.keys(sections).length) * 100) : 0,
        updatedAt: resume?.updatedAt ?? null,
      },
      artifactCounts: byKind,
      interviews: {
        total: interviews.length,
        graded: interviews.filter((i) => i.feedback).length,
      },
      applications: { total: applications.length, byStage },
    },
  });
});

module.exports = {
  getResume,
  updateResume,
  analyzeResume,
  skillGap,
  roadmap,
  companyPrep,
  listArtifacts,
  getArtifact,
  deleteArtifact,
  setMilestone,
  startInterview,
  listInterviews,
  getInterview,
  saveAnswers,
  gradeInterview,
  deleteInterview,
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  getGuidanceSession,
  sendGuidanceMessage,
  clearGuidance,
  getOverview,
};
