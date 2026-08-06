const User = require('../models/User');
const Profile = require('../models/Profile');
const MentorProfile = require('../models/MentorProfile');
const MentorshipSession = require('../models/MentorshipSession');
const MentorshipChat = require('../models/MentorshipChat');
const MentorReview = require('../models/MentorReview');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const normalizeTags = require('../utils/normalizeTags');
const { getProvider } = require('../ai');
const { notify } = require('../services/notify');
const { ROLES } = require('../utils/constants');

const USER_FIELDS = 'name role avatarUrl';
const { TRANSITIONS } = MentorshipSession;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Does [start, start+duration) fall entirely inside one of the mentor's weekly
 * windows? Checked against the window for that weekday only — a booking may not
 * straddle midnight into the next day's window.
 */
const withinAvailability = (availability, start, durationMinutes) => {
  if (!availability.length) return false;

  const day = start.getDay();
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + durationMinutes;

  return availability.some(
    (slot) => slot.day === day && startMin >= toMinutes(slot.start) && endMin <= toMinutes(slot.end)
  );
};

/** Sessions that still hold the mentor's calendar. Declined/cancelled do not. */
const BLOCKING_STATUSES = ['requested', 'confirmed'];

const hasClash = async (mentorId, start, durationMinutes, excludeId) => {
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  // Any blocking session that starts before ours ends is a candidate; the end
  // time is derived per-document since duration varies.
  const nearby = await MentorshipSession.find({
    mentor: mentorId,
    status: { $in: BLOCKING_STATUSES },
    scheduledFor: { $lt: end },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

  return nearby.some((s) => s.endsAt() > start);
};

// ---------------------------------------------------------------------------
// Mentor profiles
// ---------------------------------------------------------------------------

const MENTOR_FIELDS = [
  'headline',
  'bio',
  'expertise',
  'languages',
  'yearsExperience',
  'currentRole',
  'organisation',
  'sessionLengthMinutes',
  'availability',
  'isPublished',
  'acceptingMentees',
];

// GET /api/mentorship/mentors  — the browse list
const listMentors = asyncHandler(async (req, res) => {
  const query = { isPublished: true };

  if (req.query.expertise) {
    // Case-insensitive exact tag match, so "React" finds a mentor who typed "react".
    query.expertise = new RegExp(`^${String(req.query.expertise).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  }

  let mentors = await MentorProfile.find(query)
    .populate('user', USER_FIELDS)
    .sort({ ratingAverage: -1, completedSessions: -1 })
    .limit(100);

  // Free-text search runs in memory over the listed set: it spans the mentor's
  // own fields and their user name, which no single Mongo text index covers.
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (q) {
    mentors = mentors.filter((m) =>
      [m.headline, m.bio, m.currentRole, m.organisation, m.user?.name, ...m.expertise]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }

  // Every distinct tag in the published set, for the filter chips.
  const all = await MentorProfile.find({ isPublished: true }).select('expertise').lean();
  const expertise = [...new Set(all.flatMap((m) => m.expertise))].sort();

  res.json({
    success: true,
    data: { mentors: mentors.map((m) => m.toPublicJSON()), expertise },
  });
});

// GET /api/mentorship/mentors/:id  — :id is the mentor's *user* id
const getMentor = asyncHandler(async (req, res) => {
  const mentor = await MentorProfile.findOne({ user: req.params.id }).populate('user', USER_FIELDS);
  if (!mentor) throw new ApiError(404, 'Mentor not found');

  // An unpublished profile is visible only to its owner.
  if (!mentor.isPublished && String(req.user?._id) !== String(mentor.user._id)) {
    throw new ApiError(404, 'Mentor not found');
  }

  const [profile, reviews] = await Promise.all([
    Profile.findOne({ user: mentor.user._id }),
    MentorReview.find({ mentor: mentor.user._id })
      .populate('mentee', USER_FIELDS)
      .sort({ createdAt: -1 })
      .limit(20),
  ]);

  res.json({
    success: true,
    data: {
      mentor: mentor.toPublicJSON(),
      profile: profile ? profile.toPublicJSON() : null,
      reviews: reviews.map((r) => r.toPublicJSON()),
    },
  });
});

// GET /api/mentorship/me/mentor-profile
const getMyMentorProfile = asyncHandler(async (req, res) => {
  let mentor = await MentorProfile.findOne({ user: req.user._id }).populate('user', USER_FIELDS);
  if (!mentor) {
    mentor = await MentorProfile.create({ user: req.user._id });
    mentor = await MentorProfile.findById(mentor._id).populate('user', USER_FIELDS);
  }
  res.json({ success: true, data: { mentor: mentor.toPublicJSON() } });
});

// PUT /api/mentorship/me/mentor-profile
const updateMyMentorProfile = asyncHandler(async (req, res) => {
  const updates = {};

  for (const field of MENTOR_FIELDS) {
    if (!(field in req.body)) continue;
    const value = req.body[field];

    if (field === 'expertise' || field === 'languages') {
      updates[field] = normalizeTags(value, 20) ?? [];
    } else if (field === 'availability') {
      if (!Array.isArray(value)) throw new ApiError(400, 'availability must be an array');
      updates.availability = value.slice(0, 21).map((slot) => {
        const day = Number(slot?.day);
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          throw new ApiError(400, 'Each availability slot needs a day from 0 (Sunday) to 6');
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot?.start ?? '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot?.end ?? '')) {
          throw new ApiError(400, 'Availability times must look like "18:00"');
        }
        if (toMinutes(slot.end) <= toMinutes(slot.start)) {
          throw new ApiError(400, 'An availability window must end after it starts');
        }
        return { day, start: slot.start, end: slot.end };
      });
    } else if (field === 'yearsExperience') {
      updates.yearsExperience = Math.min(Math.max(Number(value) || 0, 0), 60);
    } else if (field === 'sessionLengthMinutes') {
      if (![15, 30, 45, 60].includes(Number(value))) {
        throw new ApiError(400, 'sessionLengthMinutes must be 15, 30, 45, or 60');
      }
      updates.sessionLengthMinutes = Number(value);
    } else if (field === 'isPublished' || field === 'acceptingMentees') {
      updates[field] = Boolean(value);
    } else {
      updates[field] = typeof value === 'string' ? value.trim() : '';
    }
  }

  // Publishing with nothing to show would put an empty card in the directory.
  if (updates.isPublished) {
    const merged = { ...(await MentorProfile.findOne({ user: req.user._id }))?.toObject(), ...updates };
    if (!merged.headline || !(merged.expertise ?? []).length || !(merged.availability ?? []).length) {
      throw new ApiError(
        400,
        'Add a headline, at least one area of expertise, and one availability window before publishing.'
      );
    }
  }

  const mentor = await MentorProfile.findOneAndUpdate({ user: req.user._id }, updates, {
    new: true,
    runValidators: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).populate('user', USER_FIELDS);

  res.json({ success: true, message: 'Mentor profile saved', data: { mentor: mentor.toPublicJSON() } });
});

// POST /api/mentorship/match  — AI recommendations over the published mentors
const matchMentors = asyncHandler(async (req, res) => {
  const goal = typeof req.body.goal === 'string' ? req.body.goal.trim().slice(0, 300) : '';

  const mentors = await MentorProfile.find({ isPublished: true, acceptingMentees: true })
    .populate('user', USER_FIELDS)
    .limit(25);

  // Never ask the model to pick from an empty list; it would invent candidates.
  if (mentors.length === 0) {
    return res.json({
      success: true,
      data: {
        matches: [],
        noteToStudent: 'No mentors are accepting mentees right now, so there is nothing to match against.',
      },
    });
  }

  const profile = await Profile.findOne({ user: req.user._id });
  const profileText = [
    `Name: ${req.user.name}`,
    profile?.fieldOfStudy && `Field of study: ${profile.fieldOfStudy}`,
    profile?.educationLevel && `Education level: ${profile.educationLevel}`,
    profile?.skills?.length && `Skills: ${profile.skills.join(', ')}`,
    profile?.interests?.length && `Interests: ${profile.interests.join(', ')}`,
    profile?.goals?.length && `Goals: ${profile.goals.join(', ')}`,
    profile?.bio && `Bio: ${profile.bio}`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await getProvider().matchMentors({
    profileText: profileText || '(This student has not filled in their profile.)',
    goal,
    mentors: mentors.map((m) => ({
      id: String(m.user._id),
      name: m.user.name,
      headline: m.headline,
      currentRole: m.currentRole,
      organisation: m.organisation,
      expertise: m.expertise,
      yearsExperience: m.yearsExperience,
      ratingAverage: m.ratingAverage,
      ratingCount: m.ratingCount,
      bio: m.bio,
    })),
  });

  // Drop anything that doesn't resolve to a real candidate rather than trusting
  // the id we got back, and attach the stored mentor so the UI needs no lookup.
  const byId = new Map(mentors.map((m) => [String(m.user._id), m]));
  const matches = (result.matches ?? [])
    .filter((m) => byId.has(String(m.mentorId)))
    .map((m) => ({ ...m, mentor: byId.get(String(m.mentorId)).toPublicJSON() }));

  res.json({ success: true, data: { matches, noteToStudent: result.noteToStudent } });
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

// POST /api/mentorship/sessions
const requestSession = asyncHandler(async (req, res) => {
  const { mentorId, scheduledFor, topic } = req.body;

  const mentorProfile = await MentorProfile.findOne({ user: mentorId }).populate('user', USER_FIELDS);
  if (!mentorProfile || !mentorProfile.isPublished) throw new ApiError(404, 'Mentor not found');
  if (String(mentorId) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot book a session with yourself');
  }
  if (!mentorProfile.acceptingMentees) {
    throw new ApiError(409, 'This mentor is not accepting new sessions right now.');
  }

  const start = new Date(scheduledFor);
  if (Number.isNaN(start.getTime())) throw new ApiError(400, 'scheduledFor is not a valid date');
  if (start.getTime() <= Date.now()) throw new ApiError(400, 'Pick a time in the future');

  const durationMinutes = mentorProfile.sessionLengthMinutes;

  if (!withinAvailability(mentorProfile.availability, start, durationMinutes)) {
    throw new ApiError(409, "That time is outside this mentor's availability.");
  }
  if (await hasClash(mentorId, start, durationMinutes)) {
    throw new ApiError(409, 'That slot is already taken. Pick another time.');
  }

  const session = await MentorshipSession.create({
    mentor: mentorId,
    mentee: req.user._id,
    topic: String(topic).trim(),
    agenda: typeof req.body.agenda === 'string' ? req.body.agenda.trim().slice(0, 2000) : '',
    scheduledFor: start,
    durationMinutes,
  });

  const populated = await MentorshipSession.findById(session._id)
    .populate('mentor', USER_FIELDS)
    .populate('mentee', USER_FIELDS);

  void notify({
    recipient: mentorId,
    actor: req.user._id,
    type: 'mentorship.requested',
    title: `${req.user.name} requested a session`,
    body: `${session.topic} · ${session.scheduledFor.toLocaleString()}`,
    link: '/mentorship/sessions',
  });

  res.status(201).json({ success: true, data: { session: populated.toPublicJSON() } });
});

// GET /api/mentorship/sessions
const listSessions = asyncHandler(async (req, res) => {
  const query = {
    $or: [{ mentor: req.user._id }, { mentee: req.user._id }],
  };
  if (req.query.status) {
    if (!MentorshipSession.STATUSES.includes(req.query.status)) {
      throw new ApiError(400, `Unknown status "${req.query.status}"`);
    }
    query.status = req.query.status;
  }

  const sessions = await MentorshipSession.find(query)
    .populate('mentor', USER_FIELDS)
    .populate('mentee', USER_FIELDS)
    .sort({ scheduledFor: 1 })
    .limit(100);

  // Which reviews already exist, so the UI can tell "rate this" from "rated".
  const reviews = await MentorReview.find({ mentee: req.user._id }).select('session').lean();
  const reviewed = new Set(reviews.map((r) => String(r.session)));

  res.json({
    success: true,
    data: {
      sessions: sessions.map((s) => ({
        ...s.toPublicJSON(),
        // Role in *this* session: a mentor can also book sessions as a mentee.
        myRole: String(s.mentor._id) === String(req.user._id) ? 'mentor' : 'mentee',
        reviewed: reviewed.has(String(s._id)),
      })),
    },
  });
});

const loadSession = async (id, userId) => {
  const session = await MentorshipSession.findById(id)
    .populate('mentor', USER_FIELDS)
    .populate('mentee', USER_FIELDS);
  if (!session) throw new ApiError(404, 'Session not found');

  const isMentor = String(session.mentor._id) === String(userId);
  const isMentee = String(session.mentee._id) === String(userId);
  if (!isMentor && !isMentee) throw new ApiError(404, 'Session not found');

  return { session, role: isMentor ? 'mentor' : 'mentee' };
};

// GET /api/mentorship/sessions/:id
const getSession = asyncHandler(async (req, res) => {
  const { session, role } = await loadSession(req.params.id, req.user._id);
  res.json({ success: true, data: { session: { ...session.toPublicJSON(), myRole: role } } });
});

// PATCH /api/mentorship/sessions/:id  — the only way a status changes
const updateSessionStatus = asyncHandler(async (req, res) => {
  const { session, role } = await loadSession(req.params.id, req.user._id);
  const next = req.body.status;

  const allowedFrom = TRANSITIONS[session.status] ?? {};
  if (!allowedFrom[next]) {
    throw new ApiError(
      409,
      `A ${session.status} session cannot become ${next || '(nothing)'}.`
    );
  }
  if (!allowedFrom[next].includes(role)) {
    throw new ApiError(403, `Only the ${allowedFrom[next].join(' or ')} can do that.`);
  }
  // Marking a meeting complete before it has started would let a mentor farm
  // reviews for sessions that never happened.
  if (next === 'completed' && session.scheduledFor.getTime() > Date.now()) {
    throw new ApiError(409, 'This session has not started yet.');
  }

  session.status = next;
  if (typeof req.body.reason === 'string') session.statusReason = req.body.reason.trim().slice(0, 500);
  if (typeof req.body.meetingLink === 'string' && role === 'mentor') {
    session.meetingLink = req.body.meetingLink.trim().slice(0, 500);
  }

  if (next === 'completed') {
    session.completedAt = new Date();
    await MentorProfile.updateOne({ user: session.mentor._id }, { $inc: { completedSessions: 1 } });
  }

  await session.save();

  // Whoever didn't make the move is the one who needs telling.
  void notify({
    recipient: role === 'mentor' ? session.mentee?._id ?? session.mentee : session.mentor?._id ?? session.mentor,
    actor: req.user._id,
    type: 'mentorship.status',
    title: `Session "${session.topic}" was ${next}`,
    body: session.statusReason,
    link: '/mentorship/sessions',
  });

  res.json({ success: true, data: { session: { ...session.toPublicJSON(), myRole: role } } });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** Recompute a mentor's rating from the reviews themselves, never incrementally. */
const refreshRating = async (mentorUserId) => {
  const [summary] = await MentorReview.aggregate([
    { $match: { mentor: mentorUserId } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await MentorProfile.updateOne(
    { user: mentorUserId },
    {
      ratingAverage: summary ? Math.round(summary.average * 10) / 10 : 0,
      ratingCount: summary ? summary.count : 0,
    }
  );
};

// POST /api/mentorship/sessions/:id/review
const reviewSession = asyncHandler(async (req, res) => {
  const { session, role } = await loadSession(req.params.id, req.user._id);

  if (role !== 'mentee') throw new ApiError(403, 'Only the mentee can review a session.');
  if (session.status !== 'completed') {
    throw new ApiError(409, 'You can only review a session once it is completed.');
  }

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'rating must be a whole number from 1 to 5');
  }

  if (await MentorReview.exists({ session: session._id })) {
    throw new ApiError(409, 'You have already reviewed this session.');
  }

  const review = await MentorReview.create({
    session: session._id,
    mentor: session.mentor._id,
    mentee: req.user._id,
    rating,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 2000) : '',
  });

  await refreshRating(session.mentor._id);

  res.status(201).json({ success: true, data: { review: review.toPublicJSON() } });
});

// GET /api/mentorship/mentors/:id/reviews
const listReviews = asyncHandler(async (req, res) => {
  const reviews = await MentorReview.find({ mentor: req.params.id })
    .populate('mentee', USER_FIELDS)
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ success: true, data: { reviews: reviews.map((r) => r.toPublicJSON()) } });
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

// GET /api/mentorship/chats
const listChats = asyncHandler(async (req, res) => {
  const chats = await MentorshipChat.find({ participants: req.user._id })
    .populate('participants', USER_FIELDS)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(50);

  res.json({
    success: true,
    data: {
      chats: chats.map((c) => {
        const json = c.toPublicJSON(req.user._id);
        return {
          id: json.id,
          // The other person is what a thread list actually shows.
          withUser: json.participants.find((p) => String(p.id ?? p) !== String(req.user._id)),
          lastMessage: json.messages.at(-1) ?? null,
          lastMessageAt: json.lastMessageAt,
          unreadCount: json.unreadCount,
        };
      }),
    },
  });
});

/** Find or create the thread between the caller and `otherId`. */
const chatWith = async (userId, otherId) => {
  const key = MentorshipChat.keyFor(userId, otherId);
  let chat = await MentorshipChat.findOne({ key });
  if (!chat) {
    chat = await MentorshipChat.create({ key, participants: [userId, otherId] });
  }
  return MentorshipChat.findById(chat._id)
    .populate('participants', USER_FIELDS)
    .populate('messages.sender', USER_FIELDS);
};

// GET /api/mentorship/chats/:userId
const getChat = asyncHandler(async (req, res) => {
  const other = await User.findById(req.params.userId);
  if (!other) throw new ApiError(404, 'User not found');
  if (String(other._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot open a chat with yourself');
  }

  const chat = await chatWith(req.user._id, other._id);

  // Opening the thread marks what is on screen as read.
  let touched = false;
  for (const message of chat.messages) {
    const senderId = String(message.sender?._id ?? message.sender);
    if (senderId !== String(req.user._id) && !message.readBy.some((id) => String(id) === String(req.user._id))) {
      message.readBy.push(req.user._id);
      touched = true;
    }
  }
  if (touched) await chat.save();

  res.json({ success: true, data: { chat: chat.toPublicJSON(req.user._id) } });
});

// POST /api/mentorship/chats/:userId
const sendChatMessage = asyncHandler(async (req, res) => {
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) throw new ApiError(400, 'A message is required');

  const other = await User.findById(req.params.userId);
  if (!other) throw new ApiError(404, 'User not found');
  if (String(other._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot message yourself');
  }

  const key = MentorshipChat.keyFor(req.user._id, other._id);
  await MentorshipChat.findOneAndUpdate(
    { key },
    {
      $setOnInsert: { key, participants: [req.user._id, other._id] },
      $push: { messages: { sender: req.user._id, body: body.slice(0, 5000), readBy: [req.user._id] } },
      $set: { lastMessageAt: new Date() },
    },
    { upsert: true }
  );

  const chat = await chatWith(req.user._id, other._id);

  // Closes the "messages appear on load, not by push" gap as far as it can
  // without a realtime transport: the recipient still won't see it arrive
  // live, but they will be told it did.
  void notify({
    recipient: other._id,
    actor: req.user._id,
    type: 'mentorship.message',
    title: `${req.user.name} sent you a message`,
    body: body.slice(0, 120),
    link: `/mentorship/chat/${req.user._id}`,
  });

  res.status(201).json({ success: true, data: { chat: chat.toPublicJSON(req.user._id) } });
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

// GET /api/mentorship/overview
const getOverview = asyncHandler(async (req, res) => {
  const [sessions, mentorProfile, chats] = await Promise.all([
    MentorshipSession.find({ $or: [{ mentor: req.user._id }, { mentee: req.user._id }] })
      .select('status mentor scheduledFor')
      .lean(),
    MentorProfile.findOne({ user: req.user._id }).lean(),
    MentorshipChat.find({ participants: req.user._id }).select('messages').lean(),
  ]);

  const byStatus = {};
  for (const s of sessions) byStatus[s.status] = (byStatus[s.status] || 0) + 1;

  const upcoming = sessions
    .filter((s) => s.status === 'confirmed' && new Date(s.scheduledFor) > new Date())
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))[0];

  const unread = chats.reduce(
    (sum, c) =>
      sum +
      c.messages.filter(
        (m) =>
          String(m.sender) !== String(req.user._id) &&
          !(m.readBy ?? []).some((id) => String(id) === String(req.user._id))
      ).length,
    0
  );

  res.json({
    success: true,
    data: {
      canMentor: req.user.role === ROLES.MENTOR || req.user.role === ROLES.ADMIN,
      isPublishedMentor: Boolean(mentorProfile?.isPublished),
      sessions: { total: sessions.length, byStatus },
      nextSessionAt: upcoming?.scheduledFor ?? null,
      unreadMessages: unread,
      rating: mentorProfile
        ? { average: mentorProfile.ratingAverage, count: mentorProfile.ratingCount }
        : null,
    },
  });
});

module.exports = {
  listMentors,
  getMentor,
  getMyMentorProfile,
  updateMyMentorProfile,
  matchMentors,
  requestSession,
  listSessions,
  getSession,
  updateSessionStatus,
  reviewSession,
  listReviews,
  listChats,
  getChat,
  sendChatMessage,
  getOverview,
};
