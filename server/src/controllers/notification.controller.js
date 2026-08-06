const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const Profile = require('../models/Profile');
const Opportunity = require('../models/Opportunity');
const SavedOpportunity = require('../models/SavedOpportunity');
const MentorshipSession = require('../models/MentorshipSession');
const Goal = require('../models/Goal');
const DailyBrief = require('../models/DailyBrief');
const Thread = require('../models/Thread');
const Comment = require('../models/Comment');

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { dayKey } = require('../utils/dayKey');
const { notify } = require('../services/notify');

const { CATEGORIES } = Notification;
const ACTOR_FIELDS = 'name avatarUrl';

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// GET /api/notifications
const listNotifications = asyncHandler(async (req, res) => {
  const query = { recipient: req.user._id };
  if (req.query.unread === 'true') query.read = false;

  if (req.query.category) {
    if (!CATEGORIES.includes(req.query.category)) {
      throw new ApiError(400, `Unknown category "${req.query.category}"`);
    }
    const types = Object.entries(Notification.TYPES)
      .filter(([, category]) => category === req.query.category)
      .map(([type]) => type);
    query.type = { $in: types };
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  const [notifications, unread] = await Promise.all([
    Notification.find(query).populate('actor', ACTOR_FIELDS).sort({ createdAt: -1 }).limit(limit),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);

  res.json({
    success: true,
    data: {
      notifications: notifications.map((n) => n.toPublicJSON()),
      unread,
      categories: CATEGORIES,
    },
  });
});

// GET /api/notifications/unread-count  — cheap enough for the header badge
const getUnreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ recipient: req.user._id, read: false });
  res.json({ success: true, data: { unread } });
});

// ---------------------------------------------------------------------------
// Derived alerts
// ---------------------------------------------------------------------------

/**
 * POST /api/notifications/sync
 *
 * Everything time-based is computed here, when the user asks, rather than by a
 * scheduler — this app has no cron and pretending otherwise would mean alerts
 * that only fire if someone remembers to run a job.
 *
 * The cost of that choice is that a deadline alert appears the next time you
 * open the app rather than the moment it becomes true. The thing that makes it
 * work is `dedupeKey`: every rule below produces a stable key, so running this
 * ten times a day still tells you about a given deadline exactly once.
 */
const syncNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const now = new Date();
  const inDays = (n) => new Date(now.getTime() + n * 86_400_000);
  const agoDays = (n) => new Date(now.getTime() - n * 86_400_000);

  const before = await Notification.countDocuments({ recipient: userId });

  // --- Event reminders: saved opportunities closing soon ---------------------
  const saved = await SavedOpportunity.find({ user: userId })
    .populate('opportunity')
    .lean();

  for (const row of saved) {
    const opportunity = row.opportunity;
    if (!opportunity?.deadline) continue;

    const deadline = new Date(opportunity.deadline);
    if (deadline < now || deadline > inDays(7)) continue;

    const days = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
    await notify({
      recipient: userId,
      type: 'reminder.deadline',
      title: `"${opportunity.title}" closes in ${days} day${days === 1 ? '' : 's'}`,
      body: `${opportunity.organisation} · you saved this one.`,
      link: `/opportunities/${opportunity._id}`,
      dedupeKey: `deadline:opportunity:${opportunity._id}`,
    });
  }

  // --- Event reminders: mentorship sessions in the next two days -------------
  const sessions = await MentorshipSession.find({
    $or: [{ mentee: userId }, { mentor: userId }],
    status: 'confirmed',
    scheduledFor: { $gte: now, $lte: inDays(2) },
  }).lean();

  for (const session of sessions) {
    await notify({
      recipient: userId,
      type: 'reminder.session',
      title: `Session on "${session.topic}" is coming up`,
      body: new Date(session.scheduledFor).toLocaleString(),
      link: '/mentorship/sessions',
      dedupeKey: `session:${session._id}`,
    });
  }

  // --- Event reminders: goals due or already overdue -------------------------
  const goals = await Goal.find({
    owner: userId,
    status: 'active',
    targetDate: { $ne: null, $lte: inDays(3) },
  }).lean();

  for (const goal of goals) {
    const overdue = new Date(goal.targetDate) < now;
    await notify({
      recipient: userId,
      type: 'reminder.goal',
      title: overdue ? `"${goal.title}" is past its date` : `"${goal.title}" is due soon`,
      body: overdue
        ? 'Still worth finishing, or worth changing the date.'
        : `Target: ${new Date(goal.targetDate).toLocaleDateString()}`,
      link: '/mentor/goals',
      // Keyed on the state as well as the goal, so "due soon" and "overdue"
      // are each said once rather than the second being swallowed by the first.
      dedupeKey: `goal:${goal._id}:${overdue ? 'overdue' : 'due'}`,
    });
  }

  // --- Internship and scholarship alerts ------------------------------------
  const profile = await Profile.findOne({ user: userId }).lean();
  const interests = [...(profile?.interests ?? []), ...(profile?.skills ?? [])].map((s) =>
    s.toLowerCase()
  );

  const fresh = await Opportunity.find({
    type: { $in: ['internship', 'scholarship'] },
    // Derived alerts carry no actor, so the usual "never notify the person who
    // caused it" rule in notify() can't apply — being told about your own
    // posting has to be excluded here instead.
    postedBy: { $ne: userId },
    createdAt: { $gte: agoDays(14) },
    $or: [{ deadline: null }, { deadline: { $gte: now } }],
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  // Prefer things that match what they said they care about; fall back to the
  // most recent when the profile is empty, rather than sending nothing.
  const matches = (o) => {
    if (interests.length === 0) return true;
    const haystack = [o.title, ...(o.tags ?? [])].join(' ').toLowerCase();
    return interests.some((term) => term.length > 2 && haystack.includes(term));
  };

  const matched = fresh.filter(matches);
  const relevant = (matched.length > 0 ? matched : fresh).slice(0, 5);

  for (const opportunity of relevant) {
    await notify({
      recipient: userId,
      type:
        opportunity.type === 'scholarship'
          ? 'opportunity.scholarship'
          : 'opportunity.internship',
      title: `New ${opportunity.type}: ${opportunity.title}`,
      body: opportunity.organisation,
      link: `/opportunities/${opportunity._id}`,
      dedupeKey: `opportunity:${opportunity._id}`,
    });
  }

  // --- New discussions where this person is already active -------------------
  const [myThreads, myComments] = await Promise.all([
    Thread.find({ author: userId }).select('community').lean(),
    Comment.find({ author: userId }).select('thread').lean(),
  ]);

  const commentThreads = await Thread.find({
    _id: { $in: myComments.map((c) => c.thread) },
  })
    .select('community')
    .lean();

  const communities = [
    ...new Set([...myThreads, ...commentThreads].map((t) => String(t.community))),
  ];

  if (communities.length > 0) {
    const newThreads = await Thread.find({
      community: { $in: communities },
      author: { $ne: userId },
      createdAt: { $gte: agoDays(3) },
    })
      .populate('community', 'name slug')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    for (const thread of newThreads) {
      await notify({
        recipient: userId,
        actor: thread.author,
        type: 'discussion.new',
        title: `New in ${thread.community?.name ?? 'a community'}: ${thread.title}`,
        link: `/community/thread/${thread._id}`,
        dedupeKey: `thread:${thread._id}`,
      });
    }
  }

  // --- AI suggestion: today's brief is unwritten ----------------------------
  const today = dayKey();
  const brief = await DailyBrief.findOne({ owner: userId, day: today }).lean();
  if (!brief) {
    await notify({
      recipient: userId,
      type: 'suggestion.brief',
      title: "Today's brief isn't written yet",
      body: 'It reads your goals and what you have actually done, and suggests what to do today.',
      link: '/mentor',
      dedupeKey: `brief:${today}`,
    });
  }

  const [after, unread] = await Promise.all([
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  res.json({ success: true, data: { created: after - before, unread } });
});

// ---------------------------------------------------------------------------
// Marking and clearing
// ---------------------------------------------------------------------------

// PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });
  if (!notification) throw new ApiError(404, 'Notification not found');

  const read = req.body.read !== false;
  notification.read = read;
  notification.readAt = read ? new Date() : null;
  await notification.save();

  res.json({ success: true, data: { notification: notification.toPublicJSON() } });
});

// POST /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true, readAt: new Date() }
  );

  res.json({ success: true, data: { updated: result.modifiedCount } });
});

// DELETE /api/notifications/read  — clear the ones already dealt with
const clearRead = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ recipient: req.user._id, read: true });
  res.json({ success: true, data: { removed: result.deletedCount } });
});

// DELETE /api/notifications/:id
const deleteNotification = asyncHandler(async (req, res) => {
  const result = await Notification.deleteOne({
    _id: req.params.id,
    recipient: req.user._id,
  });
  if (result.deletedCount === 0) throw new ApiError(404, 'Notification not found');

  res.json({ success: true, message: 'Notification removed' });
});

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

// GET /api/notifications/preferences
const getPreferences = asyncHandler(async (req, res) => {
  const preference =
    (await NotificationPreference.findOne({ user: req.user._id })) ??
    new NotificationPreference({ user: req.user._id, muted: [] });

  res.json({ success: true, data: { preferences: preference.toPublicJSON() } });
});

// PUT /api/notifications/preferences
const updatePreferences = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body.muted)) throw new ApiError(400, 'muted must be a list');

  const unknown = req.body.muted.find((c) => !CATEGORIES.includes(c));
  if (unknown) throw new ApiError(400, `Unknown category "${unknown}"`);

  const preference = await NotificationPreference.findOneAndUpdate(
    { user: req.user._id },
    { muted: [...new Set(req.body.muted)] },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, data: { preferences: preference.toPublicJSON() } });
});

module.exports = {
  listNotifications,
  getUnreadCount,
  syncNotifications,
  markRead,
  markAllRead,
  clearRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
};
