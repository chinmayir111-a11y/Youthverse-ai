const mongoose = require('mongoose');
const Community = require('../models/Community');
const Thread = require('../models/Thread');
const Comment = require('../models/Comment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../utils/constants');
const { getProvider } = require('../ai');
const { notify } = require('../services/notify');

const isStaff = (user) => [ROLES.MODERATOR, ROLES.ADMIN].includes(user.role);

/**
 * `author` is an ObjectId on an unpopulated doc and a User document on a
 * populated one. Reach through to the id in both cases — comparing a populated
 * document with String() yields the whole object, so every ownership check
 * would silently fail.
 */
const authorId = (doc) => (doc.author && doc.author._id ? doc.author._id : doc.author);
const isOwner = (doc, user) => String(authorId(doc)) === String(user._id);

/** Apply a vote of 1 / -1 / 0 to a doc with upvotes+downvotes arrays. */
const applyVote = (doc, userId, value) => {
  const id = String(userId);
  const drop = (arr) => arr.filter((x) => String(x) !== id);

  doc.upvotes = drop(doc.upvotes);
  doc.downvotes = drop(doc.downvotes);

  if (value === 1) doc.upvotes.push(userId);
  else if (value === -1) doc.downvotes.push(userId);
  // value === 0 clears the vote, which the two drops above already did.
};

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 10) break;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

// GET /api/forum/communities
const listCommunities = asyncHandler(async (req, res) => {
  const communities = await Community.find().sort({ createdAt: -1 });

  // One grouped count beats N queries as the list grows.
  const counts = await Thread.aggregate([
    { $group: { _id: '$community', count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));

  res.json({
    success: true,
    data: {
      communities: communities.map((c) => c.toPublicJSON(byId.get(String(c._id)) ?? 0)),
    },
  });
});

// POST /api/forum/communities
const createCommunity = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const slug = Community.slugify(name);

  if (!slug) throw new ApiError(400, 'Community name must contain letters or numbers');

  const existing = await Community.findOne({ slug });
  if (existing) throw new ApiError(409, `A community with the slug "${slug}" already exists`);

  const community = await Community.create({
    name: name.trim(),
    slug,
    description: (description || '').trim(),
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: { community: community.toPublicJSON(0) } });
});

const communityBySlug = async (slug) => {
  const community = await Community.findOne({ slug });
  if (!community) throw new ApiError(404, 'Community not found');
  return community;
};

// GET /api/forum/communities/:slug
const getCommunity = asyncHandler(async (req, res) => {
  const community = await communityBySlug(req.params.slug);
  const threadCount = await Thread.countDocuments({ community: community._id });
  res.json({ success: true, data: { community: community.toPublicJSON(threadCount) } });
});

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

// GET /api/forum/communities/:slug/threads?sort=new|top
const listThreads = asyncHandler(async (req, res) => {
  const community = await communityBySlug(req.params.slug);
  const threads = await Thread.find({ community: community._id })
    .populate('author', 'name role')
    .populate('community', 'name slug');

  const withScore = threads.map((t) => t.toPublicJSON(req.user?._id));

  // "top" sorts by score in memory: score is derived from two arrays, so it
  // isn't a sortable column without an aggregation stage.
  if (req.query.sort === 'top') {
    withScore.sort((a, b) => b.score - a.score || +new Date(b.createdAt) - +new Date(a.createdAt));
  } else {
    withScore.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  res.json({
    success: true,
    data: { community: community.toPublicJSON(threads.length), threads: withScore },
  });
});

// POST /api/forum/communities/:slug/threads
const createThread = asyncHandler(async (req, res) => {
  const community = await communityBySlug(req.params.slug);
  const { title, body, tags } = req.body;

  const thread = await Thread.create({
    community: community._id,
    author: req.user._id,
    title: title.trim(),
    body: body.trim(),
    tags: normalizeTags(tags),
  });

  await thread.populate([
    { path: 'author', select: 'name role' },
    { path: 'community', select: 'name slug' },
  ]);

  res.status(201).json({ success: true, data: { thread: thread.toPublicJSON(req.user._id) } });
});

const loadThread = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Thread not found');
  const thread = await Thread.findById(id)
    .populate('author', 'name role')
    .populate('community', 'name slug');
  if (!thread) throw new ApiError(404, 'Thread not found');
  return thread;
};

// GET /api/forum/threads/:id
const getThread = asyncHandler(async (req, res) => {
  const thread = await loadThread(req.params.id);
  const comments = await Comment.find({ thread: thread._id })
    .populate('author', 'name role')
    .sort({ createdAt: 1 });

  res.json({
    success: true,
    data: {
      thread: thread.toPublicJSON(req.user?._id),
      comments: comments.map((c) => c.toPublicJSON(req.user?._id, thread.bestAnswer)),
    },
  });
});

// DELETE /api/forum/threads/:id
const deleteThread = asyncHandler(async (req, res) => {
  const thread = await loadThread(req.params.id);

  if (!isOwner(thread, req.user) && !isStaff(req.user)) {
    throw new ApiError(403, 'Only the author or a moderator can delete this thread');
  }

  await Promise.all([Comment.deleteMany({ thread: thread._id }), thread.deleteOne()]);
  res.json({ success: true, message: 'Thread deleted' });
});

// POST /api/forum/threads/:id/lock   (moderators only)
const setThreadLock = asyncHandler(async (req, res) => {
  const thread = await loadThread(req.params.id);
  thread.locked = req.body.locked !== false;
  await thread.save();

  res.json({
    success: true,
    message: thread.locked ? 'Thread locked' : 'Thread unlocked',
    data: { thread: thread.toPublicJSON(req.user._id) },
  });
});

// POST /api/forum/threads/:id/vote
const voteThread = asyncHandler(async (req, res) => {
  const value = Number(req.body.value);
  if (![1, 0, -1].includes(value)) throw new ApiError(400, 'value must be 1, 0, or -1');

  const thread = await loadThread(req.params.id);
  applyVote(thread, req.user._id, value);
  await thread.save();

  res.json({ success: true, data: { thread: thread.toPublicJSON(req.user._id) } });
});

// POST /api/forum/threads/:id/best-answer
const setBestAnswer = asyncHandler(async (req, res) => {
  const thread = await loadThread(req.params.id);

  if (!isOwner(thread, req.user) && !isStaff(req.user)) {
    throw new ApiError(403, 'Only the thread author or a moderator can mark a best answer');
  }

  const { commentId } = req.body;

  if (commentId === null) {
    thread.bestAnswer = null;
  } else {
    const comment = await Comment.findOne({ _id: commentId, thread: thread._id });
    if (!comment) throw new ApiError(404, 'That comment is not on this thread');
    thread.bestAnswer = comment._id;

    void notify({
      recipient: comment.author,
      actor: req.user._id,
      type: 'discussion.best_answer',
      title: `Your answer was marked best on "${thread.title}"`,
      link: `/community/thread/${thread._id}`,
    });
  }

  await thread.save();
  res.json({ success: true, data: { thread: thread.toPublicJSON(req.user._id) } });
});

// POST /api/forum/threads/:id/summary  - AI Discussion Summary (SRS Module 5)
const summarizeThread = asyncHandler(async (req, res) => {
  const thread = await loadThread(req.params.id);
  const comments = await Comment.find({ thread: thread._id })
    .populate('author', 'name')
    .sort({ createdAt: 1 });

  if (comments.length === 0) {
    throw new ApiError(400, 'This thread has no replies to summarise yet');
  }

  const result = await getProvider().summarizeDiscussion({
    thread: {
      title: thread.title,
      body: thread.body,
      comments: comments.map((c) => ({ author: c.author?.name ?? 'User', body: c.body })),
    },
  });

  thread.summary = {
    ...result,
    generatedAtCommentCount: thread.commentCount,
    generatedAt: new Date(),
  };
  await thread.save();

  res.json({ success: true, data: { thread: thread.toPublicJSON(req.user._id) } });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

// POST /api/forum/threads/:id/comments
const createComment = asyncHandler(async (req, res) => {
  const thread = await loadThread(req.params.id);
  if (thread.locked) throw new ApiError(403, 'This thread is locked');

  const comment = await Comment.create({
    thread: thread._id,
    author: req.user._id,
    body: req.body.body.trim(),
  });

  await Thread.updateOne({ _id: thread._id }, { $inc: { commentCount: 1 } });
  await comment.populate('author', 'name role');

  // notify() drops this when the replier is the thread author, so answering
  // your own question doesn't notify you about it.
  void notify({
    recipient: thread.author?._id ?? thread.author,
    actor: req.user._id,
    type: 'discussion.reply',
    title: `${req.user.name} replied to "${thread.title}"`,
    body: comment.body.slice(0, 120),
    link: `/community/thread/${thread._id}`,
  });

  res.status(201).json({
    success: true,
    data: { comment: comment.toPublicJSON(req.user._id, thread.bestAnswer) },
  });
});

// DELETE /api/forum/comments/:id
const deleteComment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Comment not found');
  const comment = await Comment.findById(req.params.id);
  if (!comment) throw new ApiError(404, 'Comment not found');

  if (!isOwner(comment, req.user) && !isStaff(req.user)) {
    throw new ApiError(403, 'Only the author or a moderator can delete this comment');
  }

  await comment.deleteOne();

  // Decrement the count, and clear the best-answer pointer in the same write if
  // it happened to point at the comment we just removed.
  await Thread.updateOne({ _id: comment.thread }, { $inc: { commentCount: -1 } });
  await Thread.updateOne(
    { _id: comment.thread, bestAnswer: comment._id },
    { $set: { bestAnswer: null } }
  );

  res.json({ success: true, message: 'Comment deleted' });
});

// POST /api/forum/comments/:id/vote
const voteComment = asyncHandler(async (req, res) => {
  const value = Number(req.body.value);
  if (![1, 0, -1].includes(value)) throw new ApiError(400, 'value must be 1, 0, or -1');

  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Comment not found');
  const comment = await Comment.findById(req.params.id).populate('author', 'name role');
  if (!comment) throw new ApiError(404, 'Comment not found');

  applyVote(comment, req.user._id, value);
  await comment.save();

  const thread = await Thread.findById(comment.thread).select('bestAnswer');
  res.json({
    success: true,
    data: { comment: comment.toPublicJSON(req.user._id, thread?.bestAnswer) },
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// GET /api/forum/search?q=
const searchThreads = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) throw new ApiError(400, 'A search query (?q=) is required');

  const threads = await Thread.find({ $text: { $search: q } }, { relevance: { $meta: 'textScore' } })
    .sort({ relevance: { $meta: 'textScore' } })
    .limit(25)
    .populate('author', 'name role')
    .populate('community', 'name slug');

  res.json({
    success: true,
    data: { query: q, threads: threads.map((t) => t.toPublicJSON(req.user?._id)) },
  });
});

module.exports = {
  listCommunities,
  createCommunity,
  getCommunity,
  listThreads,
  createThread,
  getThread,
  deleteThread,
  setThreadLock,
  voteThread,
  setBestAnswer,
  summarizeThread,
  createComment,
  deleteComment,
  voteComment,
  searchThreads,
};
