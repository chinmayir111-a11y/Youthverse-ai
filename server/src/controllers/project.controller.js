const Project = require('../models/Project');
const ProjectReview = require('../models/ProjectReview');
const CollaborationRequest = require('../models/CollaborationRequest');
const Profile = require('../models/Profile');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const normalizeTags = require('../utils/normalizeTags');
const { getProvider } = require('../ai');
const { notify } = require('../services/notify');
const { ROLES } = require('../utils/constants');

const USER_FIELDS = 'name role avatarUrl';
const { STATUSES } = Project;
const { TRANSITIONS } = CollaborationRequest;

/** Moderators clean up anyone's project; everyone else only their own. */
const canManage = (project, user) => {
  if (!user) return false;
  if (user.role === ROLES.MODERATOR || user.role === ROLES.ADMIN) return true;
  const ownerId = project.owner?._id ?? project.owner;
  return String(ownerId) === String(user._id);
};

const isOwner = (project, user) => {
  if (!user) return false;
  const ownerId = project.owner?._id ?? project.owner;
  return String(ownerId) === String(user._id);
};

const isCollaborator = (project, user) =>
  Boolean(user) &&
  (project.collaborators ?? []).some(
    (c) => String(c?._id ?? c) === String(user._id)
  );

/**
 * Recompute a project's cached rating from its reviews.
 *
 * Re-aggregated rather than incremented, so a failed write can't leave the
 * cached average permanently wrong — the same rule the mentor ratings follow.
 */
const recomputeRating = async (projectId) => {
  const [stats] = await ProjectReview.aggregate([
    { $match: { project: projectId } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await Project.updateOne(
    { _id: projectId },
    {
      ratingAverage: stats ? Math.round(stats.average * 10) / 10 : 0,
      ratingCount: stats ? stats.count : 0,
    }
  );
};

/**
 * Decorate a page of projects with the viewer's own state in two queries
 * rather than two per project.
 */
const withViewerState = async (projects, user) => {
  if (!user) return projects.map((p) => p.toPublicJSON());

  const ids = projects.map((p) => p._id);
  const [reviews, requests] = await Promise.all([
    ProjectReview.find({ reviewer: user._id, project: { $in: ids } })
      .select('project rating')
      .lean(),
    CollaborationRequest.find({ requester: user._id, project: { $in: ids } })
      .select('project status')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const ratingByProject = new Map(reviews.map((r) => [String(r.project), r.rating]));
  // Sorted newest-first above, so the first entry seen for a project is the
  // one whose status the viewer should see on the card.
  const statusByProject = new Map();
  for (const request of requests) {
    const key = String(request.project);
    if (!statusByProject.has(key)) statusByProject.set(key, request.status);
  }

  return projects.map((p) =>
    p.toPublicJSON({
      canManage: canManage(p, user),
      isCollaborator: isCollaborator(p, user),
      myRating: ratingByProject.get(String(p._id)) ?? null,
      myRequestStatus: statusByProject.get(String(p._id)) ?? null,
    })
  );
};

// ---------------------------------------------------------------------------
// Browse
// ---------------------------------------------------------------------------

// GET /api/projects
const listProjects = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) {
      throw new ApiError(400, `Unknown status "${req.query.status}"`);
    }
    query.status = req.query.status;
  }

  const exact = (value) =>
    new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  if (req.query.tech) query.tech = exact(req.query.tech);
  if (req.query.tag) query.tags = exact(req.query.tag);
  if (req.query.lookingForTeammates === 'true') query.lookingForTeammates = true;

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) query.$text = { $search: q };

  // "Best rated" puts unrated projects last rather than first: a project with
  // no ratings is unknown, not bad, and sorting it above a well-reviewed one
  // would make the tab useless on day one.
  const sort =
    req.query.sort === 'rated'
      ? { ratingCount: -1, ratingAverage: -1, createdAt: -1 }
      : { createdAt: -1 };

  const projects = await Project.find(query)
    .populate('owner', USER_FIELDS)
    .populate('collaborators', USER_FIELDS)
    .sort(sort)
    .limit(100)
    .collation({ locale: 'en' });

  res.json({ success: true, data: { projects: await withViewerState(projects, req.user) } });
});

// GET /api/projects/meta  — the filter bar's contents
const getMeta = asyncHandler(async (req, res) => {
  const [byStatus, facetDocs, openTeams] = await Promise.all([
    Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Project.find().select('tech tags').lean(),
    Project.countDocuments({ lookingForTeammates: true }),
  ]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of byStatus) counts[row._id] = row.count;

  res.json({
    success: true,
    data: {
      statuses: STATUSES,
      counts,
      tech: [...new Set(facetDocs.flatMap((d) => d.tech))].sort().slice(0, 60),
      tags: [...new Set(facetDocs.flatMap((d) => d.tags))].sort().slice(0, 60),
      openTeams,
    },
  });
});

// GET /api/projects/me  — projects the viewer owns or builds on
const listMine = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [{ owner: req.user._id }, { collaborators: req.user._id }],
  })
    .populate('owner', USER_FIELDS)
    .populate('collaborators', USER_FIELDS)
    .sort({ updatedAt: -1 });

  res.json({ success: true, data: { projects: await withViewerState(projects, req.user) } });
});

// GET /api/projects/:id
const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', USER_FIELDS)
    .populate('collaborators', USER_FIELDS);
  if (!project) throw new ApiError(404, 'Project not found');

  const [decorated] = await withViewerState([project], req.user);
  res.json({ success: true, data: { project: decorated } });
});

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

const WRITABLE = [
  'title',
  'tagline',
  'description',
  'status',
  'repoUrl',
  'demoUrl',
  'tech',
  'tags',
  'lookingForTeammates',
  'rolesNeeded',
];

const readBody = (body) => {
  const updates = {};

  for (const field of WRITABLE) {
    if (!(field in body)) continue;
    const value = body[field];

    if (field === 'status') {
      if (!STATUSES.includes(value)) {
        throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
      }
      updates.status = value;
    } else if (field === 'tech' || field === 'tags' || field === 'rolesNeeded') {
      updates[field] = normalizeTags(value, 15) ?? [];
    } else if (field === 'lookingForTeammates') {
      updates.lookingForTeammates = Boolean(value);
    } else {
      updates[field] = typeof value === 'string' ? value.trim() : '';
    }
  }

  return updates;
};

// POST /api/projects
const createProject = asyncHandler(async (req, res) => {
  const project = await Project.create({ ...readBody(req.body), owner: req.user._id });
  const populated = await Project.findById(project._id).populate('owner', USER_FIELDS);

  res.status(201).json({
    success: true,
    data: { project: populated.toPublicJSON({ canManage: true }) },
  });
});

// PATCH /api/projects/:id
const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', USER_FIELDS)
    .populate('collaborators', USER_FIELDS);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!canManage(project, req.user)) {
    throw new ApiError(403, 'You can only edit a project you created.');
  }

  Object.assign(project, readBody(req.body));
  await project.save();

  const [decorated] = await withViewerState([project], req.user);
  res.json({ success: true, data: { project: decorated } });
});

// DELETE /api/projects/:id
const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!canManage(project, req.user)) {
    throw new ApiError(403, 'You can only delete a project you created.');
  }

  await Promise.all([
    ProjectReview.deleteMany({ project: project._id }),
    CollaborationRequest.deleteMany({ project: project._id }),
    project.deleteOne(),
  ]);

  res.json({ success: true, message: 'Project removed' });
});

// ---------------------------------------------------------------------------
// Feedback and ratings
// ---------------------------------------------------------------------------

// GET /api/projects/:id/reviews
const listReviews = asyncHandler(async (req, res) => {
  const reviews = await ProjectReview.find({ project: req.params.id })
    .populate('reviewer', USER_FIELDS)
    .sort({ createdAt: -1 });

  const canDelete = (review) => {
    if (!req.user) return false;
    if (req.user.role === ROLES.MODERATOR || req.user.role === ROLES.ADMIN) return true;
    return String(review.reviewer?._id ?? review.reviewer) === String(req.user._id);
  };

  res.json({
    success: true,
    data: { reviews: reviews.map((r) => r.toPublicJSON({ canManage: canDelete(r) })) },
  });
});

/**
 * POST /api/projects/:id/reviews
 *
 * Upserted rather than inserted: changing your mind about a project is an
 * edit, and a second row would double-count in the average.
 */
const reviewProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');

  if (isOwner(project, req.user)) {
    throw new ApiError(403, 'You cannot rate your own project.');
  }

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, 'Rating must be a whole number from 1 to 5.');
  }

  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

  await ProjectReview.findOneAndUpdate(
    { project: project._id, reviewer: req.user._id },
    { rating, comment },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await recomputeRating(project._id);

  const review = await ProjectReview.findOne({
    project: project._id,
    reviewer: req.user._id,
  }).populate('reviewer', USER_FIELDS);

  void notify({
    recipient: project.owner,
    actor: req.user._id,
    type: 'project.review',
    title: `${req.user.name} left feedback on "${project.title}"`,
    body: `${rating}/5${comment ? ` — ${comment.slice(0, 120)}` : ''}`,
    link: `/projects/${project._id}`,
  });

  res.status(201).json({
    success: true,
    data: { review: review.toPublicJSON({ canManage: true }) },
  });
});

// DELETE /api/projects/reviews/:reviewId
const deleteReview = asyncHandler(async (req, res) => {
  const review = await ProjectReview.findById(req.params.reviewId);
  if (!review) throw new ApiError(404, 'Review not found');

  const isAuthor = String(review.reviewer) === String(req.user._id);
  const isModerator = req.user.role === ROLES.MODERATOR || req.user.role === ROLES.ADMIN;
  if (!isAuthor && !isModerator) {
    throw new ApiError(403, 'You can only delete your own review.');
  }

  const projectId = review.project;
  await review.deleteOne();
  await recomputeRating(projectId);

  res.json({ success: true, message: 'Review removed' });
});

// ---------------------------------------------------------------------------
// Collaboration requests
// ---------------------------------------------------------------------------

// POST /api/projects/:id/requests
const requestCollaboration = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');

  if (isOwner(project, req.user)) {
    throw new ApiError(400, 'This is your own project.');
  }
  if (isCollaborator(project, req.user)) {
    throw new ApiError(409, 'You are already on this team.');
  }
  if (!project.lookingForTeammates) {
    throw new ApiError(409, 'This project is not looking for teammates right now.');
  }

  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 20) {
    throw new ApiError(400, 'Say something about what you would bring — at least 20 characters.');
  }

  const existing = await CollaborationRequest.findOne({
    project: project._id,
    requester: req.user._id,
    status: 'pending',
  });
  if (existing) {
    throw new ApiError(409, 'You already have an open request for this project.');
  }

  const request = await CollaborationRequest.create({
    project: project._id,
    requester: req.user._id,
    role: typeof req.body.role === 'string' ? req.body.role.trim() : '',
    message,
  });

  const populated = await CollaborationRequest.findById(request._id)
    .populate('requester', USER_FIELDS)
    .populate('project', 'title status');

  // Fire-and-forget: the request itself has already succeeded, and failing to
  // tell the owner must not turn that into an error for the person asking.
  void notify({
    recipient: project.owner,
    actor: req.user._id,
    type: 'collab.request',
    title: `${req.user.name} asked to join "${project.title}"`,
    body: request.role ? `As ${request.role}.` : '',
    link: `/projects/${project._id}`,
  });

  res.status(201).json({
    success: true,
    data: { request: populated.toPublicJSON({ mySide: 'requester' }) },
  });
});

// GET /api/projects/:id/requests  — the owner's inbox for one project
const listProjectRequests = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  if (!canManage(project, req.user)) {
    throw new ApiError(403, 'Only the project owner can see who has asked to join.');
  }

  const requests = await CollaborationRequest.find({ project: project._id })
    .populate('requester', USER_FIELDS)
    .populate('project', 'title status')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { requests: requests.map((r) => r.toPublicJSON({ mySide: 'owner' })) },
  });
});

// GET /api/projects/me/requests  — both sides, for the viewer
const listMyRequests = asyncHandler(async (req, res) => {
  const ownedIds = await Project.find({ owner: req.user._id }).distinct('_id');

  const [sent, received] = await Promise.all([
    CollaborationRequest.find({ requester: req.user._id })
      .populate('requester', USER_FIELDS)
      .populate('project', 'title status')
      .sort({ createdAt: -1 }),
    CollaborationRequest.find({ project: { $in: ownedIds } })
      .populate('requester', USER_FIELDS)
      .populate('project', 'title status')
      .sort({ createdAt: -1 }),
  ]);

  res.json({
    success: true,
    data: {
      sent: sent.map((r) => r.toPublicJSON({ mySide: 'requester' })),
      received: received.map((r) => r.toPublicJSON({ mySide: 'owner' })),
    },
  });
});

/**
 * PATCH /api/projects/requests/:requestId
 *
 * The legality of the move is decided by the TRANSITIONS table on the model,
 * not by the order of branches here. Accepting is also what puts the requester
 * on the team — the two happen together or not at all.
 */
const updateRequest = asyncHandler(async (req, res) => {
  const request = await CollaborationRequest.findById(req.params.requestId).populate(
    'requester',
    USER_FIELDS
  );
  if (!request) throw new ApiError(404, 'Request not found');

  const project = await Project.findById(request.project);
  if (!project) throw new ApiError(404, 'Project not found');

  const side = isOwner(project, req.user)
    ? 'owner'
    : String(request.requester?._id ?? request.requester) === String(req.user._id)
      ? 'requester'
      : null;
  if (!side) throw new ApiError(403, 'This request is not yours to act on.');

  const next = req.body.status;
  const allowed = TRANSITIONS[request.status]?.[next];
  if (!allowed) {
    throw new ApiError(400, `A ${request.status} request cannot become ${next}.`);
  }
  if (!allowed.includes(side)) {
    throw new ApiError(403, `Only the ${allowed.join(' or ')} can do that.`);
  }

  request.status = next;
  request.statusReason =
    typeof req.body.statusReason === 'string' ? req.body.statusReason.trim() : '';
  request.decidedAt = new Date();
  await request.save();

  if (next === 'accepted') {
    await Project.updateOne(
      { _id: project._id },
      { $addToSet: { collaborators: request.requester?._id ?? request.requester } }
    );
  }

  // Tell whichever side didn't make the move. Withdrawals need no notification
  // — the only other party is the owner, and a request quietly disappearing
  // from their inbox is not news.
  if (next === 'accepted' || next === 'declined') {
    void notify({
      recipient: request.requester?._id ?? request.requester,
      actor: req.user._id,
      type: next === 'accepted' ? 'collab.accepted' : 'collab.declined',
      title:
        next === 'accepted'
          ? `You're on the team for "${project.title}"`
          : `Your request to join "${project.title}" was declined`,
      body: request.statusReason,
      link: `/projects/${project._id}`,
    });
  }

  const populated = await CollaborationRequest.findById(request._id)
    .populate('requester', USER_FIELDS)
    .populate('project', 'title status');

  res.json({ success: true, data: { request: populated.toPublicJSON({ mySide: side }) } });
});

/**
 * DELETE /api/projects/:id/collaborators/:userId
 *
 * Serves both "the owner removed someone" and "someone left", because they are
 * the same write. Which one it was is the only thing the permission check has
 * to tell apart.
 */
const removeCollaborator = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');

  const leavingSelf = String(req.params.userId) === String(req.user._id);
  if (!canManage(project, req.user) && !leavingSelf) {
    throw new ApiError(403, 'Only the project owner can remove a collaborator.');
  }

  await Project.updateOne({ _id: project._id }, { $pull: { collaborators: req.params.userId } });

  res.json({ success: true, message: leavingSelf ? 'You left the project' : 'Collaborator removed' });
});

// ---------------------------------------------------------------------------
// AI Project Generator
// ---------------------------------------------------------------------------

// POST /api/projects/ideas
const generateIdeas = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne({ user: req.user._id });
  const profileText = [
    `Name: ${req.user.name}`,
    profile?.fieldOfStudy && `Field of study: ${profile.fieldOfStudy}`,
    profile?.educationLevel && `Education level: ${profile.educationLevel}`,
    profile?.institution && `Institution: ${profile.institution}`,
    profile?.skills?.length && `Skills: ${profile.skills.join(', ')}`,
    profile?.interests?.length && `Interests: ${profile.interests.join(', ')}`,
    profile?.goals?.length && `Goals: ${profile.goals.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const count = Math.min(Math.max(Number(req.body.count) || 4, 1), 6);
  const brief = typeof req.body.brief === 'string' ? req.body.brief.trim().slice(0, 500) : '';

  const result = await getProvider().generateProjectIdeas({
    profileText: profileText || '(This student has not filled in their profile.)',
    brief,
    count,
  });

  res.json({ success: true, data: result });
});

module.exports = {
  listProjects,
  getMeta,
  listMine,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listReviews,
  reviewProject,
  deleteReview,
  requestCollaboration,
  listProjectRequests,
  listMyRequests,
  updateRequest,
  removeCollaborator,
  generateIdeas,
};
