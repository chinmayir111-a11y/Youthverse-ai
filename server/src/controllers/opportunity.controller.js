const Opportunity = require('../models/Opportunity');
const SavedOpportunity = require('../models/SavedOpportunity');
const Application = require('../models/Application');
const Profile = require('../models/Profile');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const normalizeTags = require('../utils/normalizeTags');
const { getProvider } = require('../ai');
const { ROLES } = require('../utils/constants');

const POSTER_FIELDS = 'name role';
const { TYPES } = Opportunity;

/** Moderators clean up anyone's posting; everyone else only their own. */
const canManage = (opportunity, user) => {
  if (!user) return false;
  if (user.role === ROLES.MODERATOR || user.role === ROLES.ADMIN) return true;
  const posterId = opportunity.postedBy?._id ?? opportunity.postedBy;
  return String(posterId) === String(user._id);
};

const parseDate = (value, field) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} is not a valid date`);
  return date;
};

/**
 * Decorate a page of postings with the viewer's own state in two queries rather
 * than two per posting.
 */
const withViewerState = async (opportunities, user) => {
  if (!user) return opportunities.map((o) => o.toPublicJSON());

  const ids = opportunities.map((o) => o._id);
  const [saved, tracked] = await Promise.all([
    SavedOpportunity.find({ user: user._id, opportunity: { $in: ids } })
      .select('opportunity')
      .lean(),
    // The placement tracker has no opportunity reference, so "already tracked"
    // is matched on the link — the one field both records genuinely share.
    Application.find({ owner: user._id }).select('link').lean(),
  ]);

  const savedIds = new Set(saved.map((s) => String(s.opportunity)));
  const trackedLinks = new Set(tracked.map((a) => a.link).filter(Boolean));

  return opportunities.map((o) =>
    o.toPublicJSON({
      saved: savedIds.has(String(o._id)),
      tracked: Boolean(o.link) && trackedLinks.has(o.link),
      canManage: canManage(o, user),
    })
  );
};

// ---------------------------------------------------------------------------
// Browse
// ---------------------------------------------------------------------------

// GET /api/opportunities
const listOpportunities = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.type) {
    if (!TYPES.includes(req.query.type)) {
      throw new ApiError(400, `Unknown type "${req.query.type}"`);
    }
    query.type = req.query.type;
  }

  if (req.query.tag) {
    query.tags = new RegExp(`^${String(req.query.tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  }

  if (req.query.remote === 'true') query.isRemote = true;

  // Closed postings are hidden unless asked for: a hub full of expired listings
  // is worse than an empty one. A posting with no deadline never expires.
  if (req.query.includeExpired !== 'true') {
    query.$or = [{ deadline: null }, { deadline: { $gte: new Date() } }];
  }

  if (req.query.closingInDays) {
    const days = Math.min(Math.max(Number(req.query.closingInDays) || 7, 1), 90);
    query.deadline = { $gte: new Date(), $lte: new Date(Date.now() + days * 86_400_000) };
  }

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) query.$text = { $search: q };

  const opportunities = await Opportunity.find(query)
    .populate('postedBy', POSTER_FIELDS)
    // Soonest deadline first, but postings without one sort last rather than
    // first — a null deadline is "no rush", not "most urgent".
    .sort({ deadline: 1, createdAt: -1 })
    .limit(100)
    .collation({ locale: 'en' });

  const ordered = [
    ...opportunities.filter((o) => o.deadline),
    ...opportunities.filter((o) => !o.deadline),
  ];

  res.json({ success: true, data: { opportunities: await withViewerState(ordered, req.user) } });
});

// GET /api/opportunities/meta  — the filter bar's contents
const getMeta = asyncHandler(async (req, res) => {
  const open = { $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] };

  const [byType, tagDocs, closingSoon] = await Promise.all([
    Opportunity.aggregate([{ $match: open }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    Opportunity.find(open).select('tags').lean(),
    Opportunity.countDocuments({
      deadline: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86_400_000) },
    }),
  ]);

  const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
  for (const row of byType) counts[row._id] = row.count;

  res.json({
    success: true,
    data: {
      types: TYPES,
      counts,
      tags: [...new Set(tagDocs.flatMap((d) => d.tags))].sort().slice(0, 60),
      closingSoon,
    },
  });
});

// GET /api/opportunities/:id
const getOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.id).populate('postedBy', POSTER_FIELDS);
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');

  const [decorated] = await withViewerState([opportunity], req.user);
  res.json({ success: true, data: { opportunity: decorated } });
});

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

const WRITABLE = [
  'type',
  'title',
  'organisation',
  'description',
  'location',
  'isRemote',
  'link',
  'tags',
  'eligibility',
  'reward',
  'deadline',
  'startsAt',
];

const readBody = (body) => {
  const updates = {};

  for (const field of WRITABLE) {
    if (!(field in body)) continue;
    const value = body[field];

    if (field === 'type') {
      if (!TYPES.includes(value)) throw new ApiError(400, `type must be one of: ${TYPES.join(', ')}`);
      updates.type = value;
    } else if (field === 'tags') {
      updates.tags = normalizeTags(value, 15) ?? [];
    } else if (field === 'isRemote') {
      updates.isRemote = Boolean(value);
    } else if (field === 'deadline' || field === 'startsAt') {
      updates[field] = parseDate(value, field);
    } else {
      updates[field] = typeof value === 'string' ? value.trim() : '';
    }
  }

  return updates;
};

// POST /api/opportunities
const createOpportunity = asyncHandler(async (req, res) => {
  const updates = readBody(req.body);

  // A posting nobody can act on is noise, so the deadline must be ahead of now.
  if (updates.deadline && updates.deadline.getTime() < Date.now()) {
    throw new ApiError(400, 'That deadline has already passed.');
  }

  const opportunity = await Opportunity.create({ ...updates, postedBy: req.user._id });
  const populated = await Opportunity.findById(opportunity._id).populate('postedBy', POSTER_FIELDS);

  res.status(201).json({
    success: true,
    data: { opportunity: populated.toPublicJSON({ canManage: true }) },
  });
});

// PATCH /api/opportunities/:id
const updateOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.id).populate('postedBy', POSTER_FIELDS);
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  if (!canManage(opportunity, req.user)) {
    throw new ApiError(403, 'You can only edit a posting you created.');
  }

  Object.assign(opportunity, readBody(req.body));
  await opportunity.save();

  const [decorated] = await withViewerState([opportunity], req.user);
  res.json({ success: true, data: { opportunity: decorated } });
});

// DELETE /api/opportunities/:id
const deleteOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.id);
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  if (!canManage(opportunity, req.user)) {
    throw new ApiError(403, 'You can only delete a posting you created.');
  }

  await Promise.all([
    SavedOpportunity.deleteMany({ opportunity: opportunity._id }),
    opportunity.deleteOne(),
  ]);

  res.json({ success: true, message: 'Opportunity removed' });
});

// ---------------------------------------------------------------------------
// Saving and tracking
// ---------------------------------------------------------------------------

// POST /api/opportunities/:id/save
const saveOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.id);
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');

  // Upsert so saving twice is idempotent rather than a duplicate-key error.
  await SavedOpportunity.updateOne(
    { user: req.user._id, opportunity: opportunity._id },
    { $setOnInsert: { user: req.user._id, opportunity: opportunity._id } },
    { upsert: true }
  );

  res.json({ success: true, message: 'Saved' });
});

// DELETE /api/opportunities/:id/save
const unsaveOpportunity = asyncHandler(async (req, res) => {
  await SavedOpportunity.deleteOne({ user: req.user._id, opportunity: req.params.id });
  res.json({ success: true, message: 'Removed from saved' });
});

// GET /api/opportunities/me/saved
const listSaved = asyncHandler(async (req, res) => {
  const saved = await SavedOpportunity.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate({ path: 'opportunity', populate: { path: 'postedBy', select: POSTER_FIELDS } });

  // A bookmark can outlive its posting if it was deleted mid-session.
  const opportunities = saved.map((s) => s.opportunity).filter(Boolean);

  res.json({ success: true, data: { opportunities: await withViewerState(opportunities, req.user) } });
});

/**
 * POST /api/opportunities/:id/track
 *
 * Hands the posting to the Career Hub's placement tracker, so an internship
 * found here becomes a row the student can move through stages there instead of
 * being re-typed. Matched on the link, which is what makes a posting unique.
 */
const trackOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.id);
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');

  if (opportunity.link) {
    const existing = await Application.findOne({ owner: req.user._id, link: opportunity.link });
    if (existing) {
      throw new ApiError(409, 'This is already in your placement tracker.');
    }
  }

  const application = await Application.create({
    owner: req.user._id,
    company: opportunity.organisation,
    role: opportunity.title,
    location: opportunity.isRemote ? 'Remote' : opportunity.location,
    link: opportunity.link,
    stage: 'wishlist',
    nextStepOn: opportunity.deadline,
    notes: `Added from the Opportunities Hub (${opportunity.type}).`,
  });

  res.status(201).json({
    success: true,
    message: 'Added to your placement tracker',
    data: { application: application.toPublicJSON() },
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

// POST /api/opportunities/recommend
const recommendOpportunities = asyncHandler(async (req, res) => {
  const open = await Opportunity.find({
    $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
  })
    .sort({ deadline: 1 })
    .limit(30);

  // Never ask the model to shortlist from nothing; it would invent listings.
  if (open.length === 0) {
    return res.json({
      success: true,
      data: { picks: [], noteToStudent: 'There are no open opportunities to shortlist yet.' },
    });
  }

  const profile = await Profile.findOne({ user: req.user._id });
  const profileText = [
    `Name: ${req.user.name}`,
    profile?.fieldOfStudy && `Field of study: ${profile.fieldOfStudy}`,
    profile?.educationLevel && `Education level: ${profile.educationLevel}`,
    profile?.graduationYear && `Graduating: ${profile.graduationYear}`,
    profile?.location && `Location: ${profile.location}`,
    profile?.skills?.length && `Skills: ${profile.skills.join(', ')}`,
    profile?.interests?.length && `Interests: ${profile.interests.join(', ')}`,
    profile?.goals?.length && `Goals: ${profile.goals.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await getProvider().recommendOpportunities({
    profileText: profileText || '(This student has not filled in their profile.)',
    opportunities: open.map((o) => o.toPublicJSON()),
  });

  const byId = new Map(open.map((o) => [String(o._id), o]));
  const chosen = (result.picks ?? []).filter((p) => byId.has(String(p.opportunityId)));
  const decorated = await withViewerState(
    chosen.map((p) => byId.get(String(p.opportunityId))),
    req.user
  );

  res.json({
    success: true,
    data: {
      picks: chosen.map((pick, i) => ({ ...pick, opportunity: decorated[i] })),
      noteToStudent: result.noteToStudent,
    },
  });
});

module.exports = {
  listOpportunities,
  getMeta,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  saveOpportunity,
  unsaveOpportunity,
  listSaved,
  trackOpportunity,
  recommendOpportunities,
};
