const MoodEntry = require('../models/MoodEntry');
const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const FocusSession = require('../models/FocusSession');
const ChallengeEnrollment = require('../models/ChallengeEnrollment');

const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { dayKey, dayKeyBefore, weekdayOf, isDayKey } = require('../utils/dayKey');
const { TIPS, CHALLENGES, findChallenge } = require('../utils/wellbeingContent');
const { getProvider } = require('../ai');

const { FACTORS, MOOD_MIN, MOOD_MAX } = MoodEntry;

/**
 * Where to send someone who needs a person rather than a page.
 *
 * Deliberately configuration, not a constant: the right service is
 * institution-specific, and a hardcoded number that is wrong for the reader is
 * worse than no number at all. Unset means the UI and the model fall back to
 * naming *kinds* of people rather than inventing a service.
 */
const supportContact = () => (process.env.SUPPORT_CONTACT || '').trim();

// ---------------------------------------------------------------------------
// Mood
// ---------------------------------------------------------------------------

/**
 * Does the recent log suggest this is more than one bad week?
 *
 * Computed here rather than asked of the model on purpose. A safety signal
 * should not depend on an API key being set, on the provider being reachable,
 * or on a model's judgement on the day — and it must behave identically under
 * AI_PROVIDER=mock, which is how most of this app gets run.
 *
 * Deliberately conservative: this only ever surfaces a gentle note that support
 * exists. It is not a diagnosis, it is not shown to anyone else, and nothing in
 * the app is withheld or unlocked because of it.
 */
const assessSupport = (entries) => {
  const recent = [...entries]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 14);

  if (recent.length < 4) return { suggested: false, reason: null };

  const low = recent.filter((e) => e.mood <= 2);

  // Four or more low days in the recent window.
  if (low.length >= 4) {
    return {
      suggested: true,
      reason: `${low.length} of your last ${recent.length} logged days were at 2 or below.`,
    };
  }

  // Or three low days in a row, which a fortnight average can hide.
  let run = 0;
  for (const entry of recent) {
    run = entry.mood <= 2 ? run + 1 : 0;
    if (run >= 3) {
      return { suggested: true, reason: 'The last three logged days in a row were at 2 or below.' };
    }
  }

  return { suggested: false, reason: null };
};

const moodStats = (entries) => {
  if (entries.length === 0) {
    return { entries: 0, averageMood: null, averageSleep: null, lowDays: 0, bestDay: null };
  }

  const round1 = (n) => Math.round(n * 10) / 10;
  const slept = entries.filter((e) => e.sleepHours !== null && e.sleepHours !== undefined);

  return {
    entries: entries.length,
    averageMood: round1(entries.reduce((t, e) => t + e.mood, 0) / entries.length),
    averageSleep: slept.length
      ? round1(slept.reduce((t, e) => t + e.sleepHours, 0) / slept.length)
      : null,
    lowDays: entries.filter((e) => e.mood <= 2).length,
    bestDay: entries.reduce((best, e) => (e.mood > best.mood ? e : best), entries[0]).day,
  };
};

const readMoodBody = (body) => {
  const mood = Number(body.mood);
  if (!Number.isInteger(mood) || mood < MOOD_MIN || mood > MOOD_MAX) {
    throw new ApiError(400, `Mood must be a whole number from ${MOOD_MIN} to ${MOOD_MAX}.`);
  }

  const updates = { mood };

  if ('energy' in body && body.energy !== null && body.energy !== '') {
    const energy = Number(body.energy);
    if (!Number.isInteger(energy) || energy < MOOD_MIN || energy > MOOD_MAX) {
      throw new ApiError(400, `Energy must be a whole number from ${MOOD_MIN} to ${MOOD_MAX}.`);
    }
    updates.energy = energy;
  } else if ('energy' in body) {
    updates.energy = null;
  }

  if ('sleepHours' in body && body.sleepHours !== null && body.sleepHours !== '') {
    const hours = Number(body.sleepHours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      throw new ApiError(400, 'Sleep must be between 0 and 24 hours.');
    }
    updates.sleepHours = Math.round(hours * 10) / 10;
  } else if ('sleepHours' in body) {
    updates.sleepHours = null;
  }

  if ('factors' in body) {
    if (!Array.isArray(body.factors)) throw new ApiError(400, 'factors must be a list');
    const unknown = body.factors.find((f) => !FACTORS.includes(f));
    if (unknown) throw new ApiError(400, `Unknown factor "${unknown}"`);
    updates.factors = [...new Set(body.factors)];
  }

  if ('note' in body) {
    updates.note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
  }

  return updates;
};

/**
 * POST /api/wellbeing/mood
 *
 * Upserted per day: logging twice is a correction, not a second entry, and a
 * day with two moods on it would make every average below it meaningless.
 */
const logMood = asyncHandler(async (req, res) => {
  const day = 'day' in req.body && req.body.day ? String(req.body.day) : dayKey();
  if (!isDayKey(day)) throw new ApiError(400, 'day must be a real date as YYYY-MM-DD.');
  if (day > dayKey()) throw new ApiError(400, "You can't log a mood for a day that hasn't happened.");

  const updates = readMoodBody(req.body);

  const entry = await MoodEntry.findOneAndUpdate(
    { owner: req.user._id, day },
    { ...updates, owner: req.user._id, day },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const recent = await MoodEntry.find({
    owner: req.user._id,
    day: { $gte: dayKeyBefore(14) },
  }).lean();

  res.status(201).json({
    success: true,
    data: {
      entry: entry.toPublicJSON(),
      support: { ...assessSupport(recent), contact: supportContact() || null },
    },
  });
});

// GET /api/wellbeing/mood?days=30
const listMood = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

  const entries = await MoodEntry.find({
    owner: req.user._id,
    day: { $gte: dayKeyBefore(days - 1) },
  }).sort({ day: 1 });

  const plain = entries.map((e) => e.toPublicJSON());

  res.json({
    success: true,
    data: {
      entries: plain,
      stats: moodStats(plain),
      support: { ...assessSupport(plain), contact: supportContact() || null },
      factors: FACTORS,
      today: dayKey(),
    },
  });
});

// DELETE /api/wellbeing/mood/:day
const deleteMood = asyncHandler(async (req, res) => {
  if (!isDayKey(req.params.day)) throw new ApiError(400, 'day must be a real date as YYYY-MM-DD.');

  const result = await MoodEntry.deleteOne({ owner: req.user._id, day: req.params.day });
  if (result.deletedCount === 0) throw new ApiError(404, 'No entry for that day.');

  res.json({ success: true, message: 'Entry removed' });
});

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

/**
 * Current and longest streak for a habit, counted only over the days it
 * applies to.
 *
 * Today is a grace day: an unticked today does not break a streak, because the
 * day is not over. Yesterday is where counting starts if today is unticked.
 */
const streaksFor = (habit, doneDays) => {
  const done = new Set(doneDays);
  const applies = (key) => habit.appliesOn(weekdayOf(key));

  let current = 0;
  for (let back = 0; back < 366; back += 1) {
    const key = dayKeyBefore(back);
    if (!applies(key)) continue;
    if (done.has(key)) {
      current += 1;
    } else if (back === 0) {
      // Today isn't done yet — that's not a miss until tomorrow.
      continue;
    } else {
      break;
    }
  }

  // Longest is walked forward over the same window so the two are comparable.
  let longest = 0;
  let run = 0;
  for (let back = 365; back >= 0; back -= 1) {
    const key = dayKeyBefore(back);
    if (!applies(key)) continue;
    if (done.has(key)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (back !== 0) {
      run = 0;
    }
  }

  return { current, longest: Math.max(longest, current) };
};

const decorateHabits = async (habits, userId) => {
  if (habits.length === 0) return [];

  const logs = await HabitLog.find({
    owner: userId,
    habit: { $in: habits.map((h) => h._id) },
    day: { $gte: dayKeyBefore(365) },
  })
    .select('habit day')
    .lean();

  const byHabit = new Map();
  for (const log of logs) {
    const key = String(log.habit);
    if (!byHabit.has(key)) byHabit.set(key, []);
    byHabit.get(key).push(log.day);
  }

  const today = dayKey();
  const last7 = Array.from({ length: 7 }, (_, i) => dayKeyBefore(6 - i));

  return habits.map((habit) => {
    const days = byHabit.get(String(habit._id)) ?? [];
    const done = new Set(days);

    return habit.toPublicJSON({
      streak: streaksFor(habit, days),
      doneToday: done.has(today),
      appliesToday: habit.appliesOn(weekdayOf(today)),
      // A fortnight is too wide for a row of dots; a week reads at a glance.
      lastWeek: last7.map((day) => ({
        day,
        done: done.has(day),
        applies: habit.appliesOn(weekdayOf(day)),
      })),
    });
  });
};

// GET /api/wellbeing/habits
const listHabits = asyncHandler(async (req, res) => {
  const query = { owner: req.user._id };
  if (req.query.includeArchived !== 'true') query.archivedAt = null;

  const habits = await Habit.find(query).sort({ createdAt: 1 });
  res.json({
    success: true,
    data: { habits: await decorateHabits(habits, req.user._id), today: dayKey() },
  });
});

const readHabitBody = (body) => {
  const updates = {};

  if ('title' in body) updates.title = String(body.title ?? '').trim();
  if ('detail' in body) updates.detail = String(body.detail ?? '').trim();

  if ('daysOfWeek' in body) {
    if (!Array.isArray(body.daysOfWeek)) throw new ApiError(400, 'daysOfWeek must be a list');
    const days = [...new Set(body.daysOfWeek.map(Number))].sort((a, b) => a - b);
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new ApiError(400, 'daysOfWeek must be numbers from 0 (Sunday) to 6.');
    }
    if (days.length === 0) throw new ApiError(400, 'Pick at least one day.');
    updates.daysOfWeek = days;
  }

  if ('archived' in body) updates.archivedAt = body.archived ? new Date() : null;

  return updates;
};

// POST /api/wellbeing/habits
const createHabit = asyncHandler(async (req, res) => {
  const updates = readHabitBody(req.body);
  if (!updates.title || updates.title.length < 2) {
    throw new ApiError(400, 'Give the habit a name of at least 2 characters.');
  }

  const habit = await Habit.create({ ...updates, owner: req.user._id });
  const [decorated] = await decorateHabits([habit], req.user._id);

  res.status(201).json({ success: true, data: { habit: decorated } });
});

// PATCH /api/wellbeing/habits/:id
const updateHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, owner: req.user._id });
  if (!habit) throw new ApiError(404, 'Habit not found');

  Object.assign(habit, readHabitBody(req.body));
  await habit.save();

  const [decorated] = await decorateHabits([habit], req.user._id);
  res.json({ success: true, data: { habit: decorated } });
});

// DELETE /api/wellbeing/habits/:id
const deleteHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, owner: req.user._id });
  if (!habit) throw new ApiError(404, 'Habit not found');

  await Promise.all([HabitLog.deleteMany({ habit: habit._id }), habit.deleteOne()]);
  res.json({ success: true, message: 'Habit removed' });
});

/**
 * POST /api/wellbeing/habits/:id/log
 *
 * A completion is a row; a miss is the absence of one. Un-ticking therefore
 * deletes rather than storing a false flag that streak counting would have to
 * remember to ignore.
 */
const logHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, owner: req.user._id });
  if (!habit) throw new ApiError(404, 'Habit not found');

  const day = req.body.day ? String(req.body.day) : dayKey();
  if (!isDayKey(day)) throw new ApiError(400, 'day must be a real date as YYYY-MM-DD.');
  if (day > dayKey()) throw new ApiError(400, "You can't tick off a day that hasn't happened.");

  if (req.body.done === false) {
    await HabitLog.deleteOne({ habit: habit._id, day });
  } else {
    await HabitLog.updateOne(
      { habit: habit._id, day },
      { $setOnInsert: { owner: req.user._id, habit: habit._id, day } },
      { upsert: true }
    );
  }

  const [decorated] = await decorateHabits([habit], req.user._id);
  res.json({ success: true, data: { habit: decorated } });
});

// ---------------------------------------------------------------------------
// Focus sessions (Pomodoro)
// ---------------------------------------------------------------------------

// POST /api/wellbeing/focus
const logFocus = asyncHandler(async (req, res) => {
  const minutes = Number(req.body.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    throw new ApiError(400, 'A session must be between 1 and 240 minutes.');
  }

  const kind = req.body.kind === 'break' ? 'break' : 'focus';

  const session = await FocusSession.create({
    owner: req.user._id,
    day: dayKey(),
    minutes: Math.round(minutes),
    kind,
    label: typeof req.body.label === 'string' ? req.body.label.trim().slice(0, 200) : '',
  });

  res.status(201).json({ success: true, data: { session: session.toPublicJSON() } });
});

const focusSummary = async (userId) => {
  const sessions = await FocusSession.find({
    owner: userId,
    day: { $gte: dayKeyBefore(6) },
    kind: 'focus',
  }).lean();

  const today = dayKey();
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const day = dayKeyBefore(6 - i);
    const forDay = sessions.filter((s) => s.day === day);
    return {
      day,
      minutes: forDay.reduce((t, s) => t + s.minutes, 0),
      sessions: forDay.length,
    };
  });

  return {
    todayMinutes: byDay.find((d) => d.day === today)?.minutes ?? 0,
    todaySessions: byDay.find((d) => d.day === today)?.sessions ?? 0,
    weekMinutes: byDay.reduce((t, d) => t + d.minutes, 0),
    byDay,
  };
};

// GET /api/wellbeing/focus
const listFocus = asyncHandler(async (req, res) => {
  const [summary, recent] = await Promise.all([
    focusSummary(req.user._id),
    FocusSession.find({ owner: req.user._id }).sort({ createdAt: -1 }).limit(20),
  ]);

  res.json({
    success: true,
    data: { summary, recent: recent.map((s) => s.toPublicJSON()) },
  });
});

// ---------------------------------------------------------------------------
// Tips and challenges
// ---------------------------------------------------------------------------

// GET /api/wellbeing/tips
const listTips = asyncHandler(async (req, res) => {
  const tag = typeof req.query.tag === 'string' ? req.query.tag : '';
  const tips = tag ? TIPS.filter((t) => t.tag === tag) : TIPS;

  res.json({
    success: true,
    data: { tips, tags: [...new Set(TIPS.map((t) => t.tag))] },
  });
});

const decorateEnrollment = (enrollment) => {
  const challenge = findChallenge(enrollment.challengeKey);
  return {
    id: enrollment._id,
    challenge,
    status: enrollment.status,
    completedDays: enrollment.completedDays,
    // Derived so the client can't disagree with the row.
    daysDone: enrollment.completedDays.length,
    daysTotal: challenge?.days ?? 0,
    doneToday: enrollment.completedDays.includes(dayKey()),
    startedAt: enrollment.startedAt,
    finishedAt: enrollment.finishedAt,
  };
};

// GET /api/wellbeing/challenges
const listChallenges = asyncHandler(async (req, res) => {
  const enrollments = await ChallengeEnrollment.find({ owner: req.user._id }).sort({
    createdAt: -1,
  });

  const active = enrollments.filter((e) => e.status === 'active');

  res.json({
    success: true,
    data: {
      challenges: CHALLENGES,
      // Only active runs block re-joining, so the client needs them separately.
      active: active.map(decorateEnrollment),
      history: enrollments.filter((e) => e.status !== 'active').map(decorateEnrollment),
      today: dayKey(),
    },
  });
});

// POST /api/wellbeing/challenges/:key/join
const joinChallenge = asyncHandler(async (req, res) => {
  const challenge = findChallenge(req.params.key);
  if (!challenge) throw new ApiError(404, 'No such challenge.');

  const existing = await ChallengeEnrollment.findOne({
    owner: req.user._id,
    challengeKey: challenge.key,
    status: 'active',
  });
  if (existing) throw new ApiError(409, "You're already doing this one.");

  const enrollment = await ChallengeEnrollment.create({
    owner: req.user._id,
    challengeKey: challenge.key,
  });

  res.status(201).json({ success: true, data: { enrollment: decorateEnrollment(enrollment) } });
});

/**
 * POST /api/wellbeing/challenges/:key/checkin
 *
 * Ticks today off. A challenge completes when it has as many ticked days as it
 * asks for — days do not have to be consecutive, because a challenge that
 * resets on one missed day is a challenge most people abandon on day two.
 */
const checkinChallenge = asyncHandler(async (req, res) => {
  const challenge = findChallenge(req.params.key);
  if (!challenge) throw new ApiError(404, 'No such challenge.');

  const enrollment = await ChallengeEnrollment.findOne({
    owner: req.user._id,
    challengeKey: challenge.key,
    status: 'active',
  });
  if (!enrollment) throw new ApiError(404, "You're not doing this challenge right now.");

  const today = dayKey();
  const done = new Set(enrollment.completedDays);

  if (req.body.done === false) done.delete(today);
  else done.add(today);

  enrollment.completedDays = [...done].sort();

  if (enrollment.completedDays.length >= challenge.days) {
    enrollment.status = 'completed';
    enrollment.finishedAt = new Date();
  }

  await enrollment.save();

  res.json({ success: true, data: { enrollment: decorateEnrollment(enrollment) } });
});

// POST /api/wellbeing/challenges/:key/leave
const leaveChallenge = asyncHandler(async (req, res) => {
  const enrollment = await ChallengeEnrollment.findOne({
    owner: req.user._id,
    challengeKey: req.params.key,
    status: 'active',
  });
  if (!enrollment) throw new ApiError(404, "You're not doing this challenge right now.");

  enrollment.status = 'abandoned';
  enrollment.finishedAt = new Date();
  await enrollment.save();

  res.json({ success: true, message: 'Left the challenge' });
});

// ---------------------------------------------------------------------------
// Overview and check-in
// ---------------------------------------------------------------------------

// GET /api/wellbeing/overview
const getOverview = asyncHandler(async (req, res) => {
  const [todayMood, recentEntries, habits, focus, enrollments] = await Promise.all([
    MoodEntry.findOne({ owner: req.user._id, day: dayKey() }),
    MoodEntry.find({ owner: req.user._id, day: { $gte: dayKeyBefore(29) } }).lean(),
    Habit.find({ owner: req.user._id, archivedAt: null }).sort({ createdAt: 1 }),
    focusSummary(req.user._id),
    ChallengeEnrollment.find({ owner: req.user._id, status: 'active' }),
  ]);

  // Rotates daily rather than randomly, so the tip is stable if you reload and
  // still changes tomorrow. Seeded off the date alone — nothing user-specific.
  const seed = Number(dayKey().replaceAll('-', ''));

  res.json({
    success: true,
    data: {
      today: dayKey(),
      mood: todayMood ? todayMood.toPublicJSON() : null,
      stats: moodStats(recentEntries),
      support: { ...assessSupport(recentEntries), contact: supportContact() || null },
      habits: await decorateHabits(habits, req.user._id),
      focus,
      challenges: enrollments.map(decorateEnrollment),
      tipOfTheDay: TIPS[seed % TIPS.length],
    },
  });
});

/**
 * POST /api/wellbeing/checkin
 *
 * Reads the log back to the student.
 *
 * The free-text `note` on each mood entry is deliberately excluded from what
 * is sent to the provider. It is the most private thing in the app — a diary
 * line written for nobody — and a student writing it should not have to assume
 * it is shipped off for analysis. The numbers and factors are enough to see a
 * pattern, and they are what the student chose from a fixed list.
 */
const generateCheckin = asyncHandler(async (req, res) => {
  const entries = await MoodEntry.find({
    owner: req.user._id,
    day: { $gte: dayKeyBefore(29) },
  })
    .select('day mood energy sleepHours factors')
    .sort({ day: 1 })
    .lean();

  if (entries.length === 0) {
    throw new ApiError(400, 'Log a few days first — there is nothing to read back yet.');
  }

  const habits = await Habit.find({ owner: req.user._id, archivedAt: null });
  const [decorated, focus] = await Promise.all([
    decorateHabits(habits, req.user._id),
    focusSummary(req.user._id),
  ]);

  const stats = moodStats(entries);
  const support = assessSupport(entries);

  const logText = [
    `Days logged in the last 30: ${stats.entries}`,
    `Average mood: ${stats.averageMood}/5 (1 is worst, 5 is best)`,
    stats.averageSleep !== null ? `Average sleep: ${stats.averageSleep} hours` : 'Sleep: not logged',
    `Days at 2 or below: ${stats.lowDays}`,
    '',
    'DAY BY DAY',
    ...entries.map(
      (e) =>
        `${e.day}: mood ${e.mood}` +
        (e.energy ? `, energy ${e.energy}` : '') +
        (e.sleepHours !== null && e.sleepHours !== undefined ? `, slept ${e.sleepHours}h` : '') +
        (e.factors?.length ? `, factors: ${e.factors.join(', ')}` : ''),
    ),
    '',
    'HABITS',
    decorated.length
      ? decorated
          .map((h) => `- ${h.title}: ${h.streak.current} day streak (longest ${h.streak.longest})`)
          .join('\n')
      : '(none tracked)',
    '',
    `Focus time this week: ${focus.weekMinutes} minutes across ${focus.byDay.reduce((t, d) => t + d.sessions, 0)} sessions`,
  ].join('\n');

  const checkin = await getProvider().generateWellbeingCheckin({
    logText,
    supportContext: supportContact() || null,
    // The mock provider works from the structured stats rather than the prose.
    stats,
  });

  res.json({
    success: true,
    data: {
      checkin,
      support: { ...support, contact: supportContact() || null },
    },
  });
});

module.exports = {
  getOverview,
  logMood,
  listMood,
  deleteMood,
  listHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  logHabit,
  logFocus,
  listFocus,
  listTips,
  listChallenges,
  joinChallenge,
  checkinChallenge,
  leaveChallenge,
  generateCheckin,
};
