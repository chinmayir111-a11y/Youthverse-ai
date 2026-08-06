const Goal = require('../models/Goal');
const DailyBrief = require('../models/DailyBrief');
const StudyPlan = require('../models/StudyPlan');

const Profile = require('../models/Profile');
const Document = require('../models/Document');
const StudyArtifact = require('../models/StudyArtifact');
const Resume = require('../models/Resume');
const CareerArtifact = require('../models/CareerArtifact');
const InterviewSession = require('../models/InterviewSession');
const Application = require('../models/Application');
const MentorshipSession = require('../models/MentorshipSession');
const Project = require('../models/Project');
const Resource = require('../models/Resource');
const SavedResource = require('../models/SavedResource');
const Thread = require('../models/Thread');
const Comment = require('../models/Comment');

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { dayKey } = require('../utils/dayKey');
const { getProvider } = require('../ai');

const { CATEGORIES, STATUSES } = Goal;

const profileTextFor = async (user) => {
  const profile = await Profile.findOne({ user: user._id });
  return (
    [
      `Name: ${user.name}`,
      profile?.fieldOfStudy && `Field of study: ${profile.fieldOfStudy}`,
      profile?.educationLevel && `Education level: ${profile.educationLevel}`,
      profile?.institution && `Institution: ${profile.institution}`,
      profile?.graduationYear && `Graduating: ${profile.graduationYear}`,
      profile?.skills?.length && `Skills: ${profile.skills.join(', ')}`,
      profile?.interests?.length && `Interests: ${profile.interests.join(', ')}`,
      profile?.goals?.length && `Stated goals: ${profile.goals.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n') || '(This student has not filled in their profile.)'
  );
};

// ---------------------------------------------------------------------------
// Learning analytics
// ---------------------------------------------------------------------------

/**
 * Everything here is counted from real rows. Nothing is estimated and nothing
 * is generated.
 *
 * Note what is deliberately absent: quiz *scores*. The app generates quizzes
 * but never records an attempt, so there is no honest score to report and this
 * counts decks generated instead. Interview scores are real — those are graded
 * and stored — so those are reported as they are.
 */
const collectAnalytics = async (userId) => {
  const since = (days) => new Date(Date.now() - days * 86_400_000);
  const week = since(7);

  const [
    documents,
    artifacts,
    resume,
    careerArtifacts,
    interviews,
    applications,
    mentorshipDone,
    projectsOwned,
    projectsJoined,
    resourcesShared,
    resourcesSaved,
    threads,
    comments,
    goals,
    docsThisWeek,
    interviewsThisWeek,
  ] = await Promise.all([
    Document.countDocuments({ owner: userId }),
    StudyArtifact.find({ owner: userId }).select('kind').lean(),
    Resume.exists({ owner: userId }),
    CareerArtifact.find({ owner: userId }).select('kind completedMilestones').lean(),
    InterviewSession.find({ owner: userId }).select('feedback createdAt').lean(),
    Application.find({ owner: userId }).select('stage').lean(),
    MentorshipSession.countDocuments({
      $or: [{ mentee: userId }, { mentor: userId }],
      status: 'completed',
    }),
    Project.countDocuments({ owner: userId }),
    Project.countDocuments({ collaborators: userId }),
    Resource.find({ uploadedBy: userId }).select('downloadCount').lean(),
    SavedResource.countDocuments({ user: userId }),
    Thread.countDocuments({ author: userId }),
    Comment.countDocuments({ author: userId }),
    Goal.find({ owner: userId }).lean(),
    Document.countDocuments({ owner: userId, createdAt: { $gte: week } }),
    InterviewSession.countDocuments({ owner: userId, createdAt: { $gte: week } }),
  ]);

  const byKind = (rows, kinds) => {
    const out = Object.fromEntries(kinds.map((k) => [k, 0]));
    for (const row of rows) if (row.kind in out) out[row.kind] += 1;
    return out;
  };

  const graded = interviews.filter((i) => i.feedback?.overallScore != null);
  const scores = graded.map((i) => i.feedback.overallScore);

  const stages = ['wishlist', 'applied', 'assessment', 'interview', 'offer', 'rejected'];
  const byStage = Object.fromEntries(stages.map((s) => [s, 0]));
  for (const app of applications) if (app.stage in byStage) byStage[app.stage] += 1;

  const activeGoals = goals.filter((g) => g.status === 'active');
  const goalProgress = (goal) => {
    if (!goal.steps?.length) return goal.manualProgress ?? 0;
    return Math.round((goal.steps.filter((s) => s.done).length / goal.steps.length) * 100);
  };

  return {
    study: {
      documents,
      quizzes: byKind(artifacts, ['quiz', 'flashcards', 'notes']).quiz,
      flashcardDecks: byKind(artifacts, ['quiz', 'flashcards', 'notes']).flashcards,
      noteSets: byKind(artifacts, ['quiz', 'flashcards', 'notes']).notes,
      documentsThisWeek: docsThisWeek,
    },
    career: {
      hasResume: Boolean(resume),
      artifacts: byKind(careerArtifacts, ['ats', 'skill_gap', 'roadmap', 'company_prep']),
      roadmapMilestonesDone: careerArtifacts.reduce(
        (total, a) => total + (a.completedMilestones?.length ?? 0),
        0
      ),
      interviews: { total: interviews.length, graded: graded.length, thisWeek: interviewsThisWeek },
      // Only meaningful once something has been graded; null rather than 0, so
      // "never tried" doesn't render as "scored zero".
      averageInterviewScore: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
      bestInterviewScore: scores.length ? Math.max(...scores) : null,
      applications: { total: applications.length, byStage },
    },
    community: {
      threads,
      comments,
      mentorshipSessionsCompleted: mentorshipDone,
    },
    building: {
      projectsOwned,
      projectsJoined,
      resourcesShared: resourcesShared.length,
      resourceDownloads: resourcesShared.reduce((total, r) => total + (r.downloadCount ?? 0), 0),
      resourcesSaved,
    },
    goals: {
      total: goals.length,
      active: activeGoals.length,
      achieved: goals.filter((g) => g.status === 'achieved').length,
      overdue: activeGoals.filter(
        (g) => g.targetDate && new Date(g.targetDate).getTime() < Date.now()
      ).length,
      averageProgress: activeGoals.length
        ? Math.round(
            activeGoals.reduce((total, g) => total + goalProgress(g), 0) / activeGoals.length
          )
        : null,
    },
  };
};

// GET /api/mentor/analytics
const getAnalytics = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { analytics: await collectAnalytics(req.user._id) } });
});

// GET /api/mentor/overview
const getOverview = asyncHandler(async (req, res) => {
  const [analytics, goals, brief, plans] = await Promise.all([
    collectAnalytics(req.user._id),
    Goal.find({ owner: req.user._id, status: 'active' }).sort({ targetDate: 1, createdAt: -1 }).limit(5),
    DailyBrief.findOne({ owner: req.user._id, day: dayKey() }),
    StudyPlan.countDocuments({ owner: req.user._id }),
  ]);

  res.json({
    success: true,
    data: {
      analytics,
      goals: goals.map((g) => g.toPublicJSON()),
      brief: brief ? brief.toPublicJSON() : null,
      planCount: plans,
      today: dayKey(),
    },
  });
});

// ---------------------------------------------------------------------------
// Goal tracking
// ---------------------------------------------------------------------------

const readGoalBody = (body) => {
  const updates = {};

  if ('title' in body) updates.title = String(body.title ?? '').trim();
  if ('detail' in body) updates.detail = String(body.detail ?? '').trim();

  if ('category' in body) {
    if (!CATEGORIES.includes(body.category)) {
      throw new ApiError(400, `category must be one of: ${CATEGORIES.join(', ')}`);
    }
    updates.category = body.category;
  }

  if ('status' in body) {
    if (!STATUSES.includes(body.status)) {
      throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
    }
    updates.status = body.status;
    // Kept in step with status rather than set independently, so a goal can't
    // be "active" while carrying the date it was finished.
    updates.achievedAt = body.status === 'achieved' ? new Date() : null;
  }

  if ('targetDate' in body) {
    const value = body.targetDate;
    if (value === null || value === '') {
      updates.targetDate = null;
    } else {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw new ApiError(400, 'targetDate is not a valid date');
      updates.targetDate = date;
    }
  }

  if ('manualProgress' in body) {
    const value = Number(body.manualProgress);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new ApiError(400, 'Progress must be between 0 and 100.');
    }
    updates.manualProgress = Math.round(value);
  }

  if ('steps' in body) {
    if (!Array.isArray(body.steps)) throw new ApiError(400, 'steps must be a list');
    updates.steps = body.steps
      .map((step) => ({
        title: String(step?.title ?? '').trim(),
        done: Boolean(step?.done),
      }))
      .filter((step) => step.title)
      .slice(0, 30);
  }

  return updates;
};

// GET /api/mentor/goals
const listGoals = asyncHandler(async (req, res) => {
  const query = { owner: req.user._id };
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) {
      throw new ApiError(400, `Unknown status "${req.query.status}"`);
    }
    query.status = req.query.status;
  }

  const goals = await Goal.find(query).sort({ status: 1, targetDate: 1, createdAt: -1 });
  res.json({ success: true, data: { goals: goals.map((g) => g.toPublicJSON()) } });
});

// POST /api/mentor/goals
const createGoal = asyncHandler(async (req, res) => {
  const updates = readGoalBody(req.body);
  if (!updates.title || updates.title.length < 3) {
    throw new ApiError(400, 'Give the goal a title of at least 3 characters.');
  }

  const goal = await Goal.create({ ...updates, owner: req.user._id });
  res.status(201).json({ success: true, data: { goal: goal.toPublicJSON() } });
});

// PATCH /api/mentor/goals/:id
const updateGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id });
  if (!goal) throw new ApiError(404, 'Goal not found');

  Object.assign(goal, readGoalBody(req.body));
  await goal.save();

  res.json({ success: true, data: { goal: goal.toPublicJSON() } });
});

// DELETE /api/mentor/goals/:id
const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id });
  if (!goal) throw new ApiError(404, 'Goal not found');

  // A plan written for a goal outlives it — the weeks of work are still valid
  // even once the goal they were aimed at is gone, so the link is cleared
  // rather than the plan deleted.
  await Promise.all([
    StudyPlan.updateMany({ owner: req.user._id, goal: goal._id }, { goal: null }),
    goal.deleteOne(),
  ]);

  res.json({ success: true, message: 'Goal removed' });
});

// ---------------------------------------------------------------------------
// Daily recommendations
// ---------------------------------------------------------------------------

// GET /api/mentor/brief
const getBrief = asyncHandler(async (req, res) => {
  const brief = await DailyBrief.findOne({ owner: req.user._id, day: dayKey() });
  res.json({
    success: true,
    data: { brief: brief ? brief.toPublicJSON() : null, today: dayKey() },
  });
});

/**
 * POST /api/mentor/brief
 *
 * Returns today's brief if one already exists, so opening the page twice costs
 * nothing. `regenerate: true` rewrites it in place — the unique index means
 * there is never a second brief for the same day to disagree with.
 */
const generateBrief = asyncHandler(async (req, res) => {
  const today = dayKey();
  const existing = await DailyBrief.findOne({ owner: req.user._id, day: today });

  if (existing && !req.body.regenerate) {
    return res.json({ success: true, data: { brief: existing.toPublicJSON(), reused: true } });
  }

  const [profileText, goals, analytics] = await Promise.all([
    profileTextFor(req.user),
    Goal.find({ owner: req.user._id, status: 'active' }).sort({ targetDate: 1 }).limit(10),
    collectAnalytics(req.user._id),
  ]);

  const goalsPublic = goals.map((g) => g.toPublicJSON());
  const goalsText = goalsPublic.length
    ? goalsPublic
        .map(
          (g) =>
            `- ${g.title} (${g.category}, ${g.progress}% done${
              g.daysLeft === null ? ', no target date' : `, ${g.daysLeft} days left`
            })${g.detail ? ` — ${g.detail}` : ''}`
        )
        .join('\n')
    : '(No goals tracked yet.)';

  const activityText = [
    `Documents uploaded: ${analytics.study.documents} (${analytics.study.documentsThisWeek} this week)`,
    `Quizzes generated: ${analytics.study.quizzes}, flashcard decks: ${analytics.study.flashcardDecks}, note sets: ${analytics.study.noteSets}`,
    `Resume on file: ${analytics.career.hasResume ? 'yes' : 'no'}`,
    `Mock interviews: ${analytics.career.interviews.total} total, ${analytics.career.interviews.graded} graded` +
      (analytics.career.averageInterviewScore !== null
        ? `, average score ${analytics.career.averageInterviewScore}/100`
        : ', none graded yet'),
    `Applications tracked: ${analytics.career.applications.total}`,
    `Projects: ${analytics.building.projectsOwned} owned, ${analytics.building.projectsJoined} joined`,
    `Resources shared: ${analytics.building.resourcesShared}, saved: ${analytics.building.resourcesSaved}`,
    `Forum: ${analytics.community.threads} threads, ${analytics.community.comments} comments`,
    `Mentorship sessions completed: ${analytics.community.mentorshipSessionsCompleted}`,
    `Goals: ${analytics.goals.active} active, ${analytics.goals.achieved} achieved, ${analytics.goals.overdue} overdue`,
  ].join('\n');

  const payload = await getProvider().generateDailyBrief({
    profileText,
    goalsText,
    activityText,
    today,
    // The mock provider works from structured values rather than the prose above.
    goals: goalsPublic,
    activity: {
      documents: analytics.study.documents,
      interviewsGraded: analytics.career.interviews.graded,
      goals: analytics.goals.active,
    },
  });

  const brief = await DailyBrief.findOneAndUpdate(
    { owner: req.user._id, day: today },
    { payload, ...(existing ? { completedActions: [] } : {}) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(existing ? 200 : 201).json({
    success: true,
    data: { brief: brief.toPublicJSON(), reused: false },
  });
});

// PATCH /api/mentor/brief/actions  — tick an action off today's brief
const toggleBriefAction = asyncHandler(async (req, res) => {
  const brief = await DailyBrief.findOne({ owner: req.user._id, day: dayKey() });
  if (!brief) throw new ApiError(404, "There's no brief for today yet.");

  const index = Number(req.body.index);
  const actions = brief.payload?.actions ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= actions.length) {
    throw new ApiError(400, 'That action is not in today’s brief.');
  }

  const done = Boolean(req.body.done);
  const current = new Set(brief.completedActions);
  if (done) current.add(index);
  else current.delete(index);

  brief.completedActions = [...current].sort((a, b) => a - b);
  await brief.save();

  res.json({ success: true, data: { brief: brief.toPublicJSON() } });
});

// ---------------------------------------------------------------------------
// Personalised study plans
// ---------------------------------------------------------------------------

// GET /api/mentor/plans
const listPlans = asyncHandler(async (req, res) => {
  const plans = await StudyPlan.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { plans: plans.map((p) => p.toPublicJSON()) } });
});

// GET /api/mentor/plans/:id
const getPlan = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOne({ _id: req.params.id, owner: req.user._id });
  if (!plan) throw new ApiError(404, 'Plan not found');
  res.json({ success: true, data: { plan: plan.toPublicJSON() } });
});

// POST /api/mentor/plans
const createPlan = asyncHandler(async (req, res) => {
  const topic = typeof req.body.topic === 'string' ? req.body.topic.trim() : '';
  if (topic.length < 3) {
    throw new ApiError(400, 'Say what the plan is for, in at least 3 characters.');
  }

  const weeks = Math.min(Math.max(Number(req.body.weeks) || 4, 1), 12);
  const hoursPerWeek = Math.min(Math.max(Number(req.body.hoursPerWeek) || 6, 1), 40);

  // A plan can be attached to a tracked goal, but only to one the caller owns.
  let goalId = null;
  if (req.body.goalId) {
    const goal = await Goal.findOne({ _id: req.body.goalId, owner: req.user._id });
    if (!goal) throw new ApiError(404, 'Goal not found');
    goalId = goal._id;
  }

  const [profileText, documents] = await Promise.all([
    profileTextFor(req.user),
    Document.find({ owner: req.user._id }).select('title').sort({ createdAt: -1 }).limit(15).lean(),
  ]);

  const contextText = documents.length
    ? documents.map((d) => `- ${d.title}`).join('\n')
    : '';

  const payload = await getProvider().generateStudyPlan({
    profileText,
    topic,
    weeks,
    hoursPerWeek,
    contextText,
  });

  const plan = await StudyPlan.create({
    owner: req.user._id,
    goal: goalId,
    title: payload.title || `Study plan: ${topic}`,
    input: { topic, weeks, hoursPerWeek },
    payload,
  });

  res.status(201).json({ success: true, data: { plan: plan.toPublicJSON() } });
});

/**
 * PATCH /api/mentor/plans/:id/items
 *
 * Keys are "<weekIndex>.<taskIndex>" and are validated against the plan, so a
 * key that doesn't address a real task is rejected rather than stored — the
 * same contract the Career Hub roadmap uses.
 */
const togglePlanItem = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOne({ _id: req.params.id, owner: req.user._id });
  if (!plan) throw new ApiError(404, 'Plan not found');

  const key = String(req.body.key ?? '');
  const [weekPart, taskPart] = key.split('.');
  const weekIndex = Number(weekPart);
  const taskIndex = Number(taskPart);

  const week = plan.payload?.weeks?.[weekIndex];
  if (!Number.isInteger(weekIndex) || !Number.isInteger(taskIndex) || !week?.tasks?.[taskIndex]) {
    throw new ApiError(400, `"${key}" does not address a task in this plan.`);
  }

  const done = Boolean(req.body.done);
  const current = new Set(plan.completedItems);
  if (done) current.add(key);
  else current.delete(key);

  plan.completedItems = [...current];
  await plan.save();

  res.json({ success: true, data: { plan: plan.toPublicJSON() } });
});

// DELETE /api/mentor/plans/:id
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await StudyPlan.findOne({ _id: req.params.id, owner: req.user._id });
  if (!plan) throw new ApiError(404, 'Plan not found');

  await plan.deleteOne();
  res.json({ success: true, message: 'Plan removed' });
});

module.exports = {
  getOverview,
  getAnalytics,
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getBrief,
  generateBrief,
  toggleBriefAction,
  listPlans,
  getPlan,
  createPlan,
  togglePlanItem,
  deletePlan,
};
