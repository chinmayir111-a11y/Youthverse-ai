const Document = require('../models/Document');
const ChatSession = require('../models/ChatSession');
const StudyArtifact = require('../models/StudyArtifact');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getProvider } = require('../ai');

/** Load a document, or 404 if it doesn't exist or isn't the caller's. */
const ownedDocument = async (docId, userId) => {
  const doc = await Document.findOne({ _id: docId, owner: userId });
  if (!doc) throw new ApiError(404, 'Document not found');
  return doc;
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

// POST /api/study/documents
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Send a PDF in the "file" field.');
  }

  const provider = getProvider();
  const { providerFileId } = await provider.uploadDocument({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
  });

  const doc = await Document.create({
    owner: req.user._id,
    title: (req.body.title || req.file.originalname.replace(/\.pdf$/i, '')).slice(0, 200),
    originalName: req.file.originalname,
    sizeBytes: req.file.size,
    providerFileId,
    provider: provider.name,
  });

  res.status(201).json({ success: true, data: { document: doc.toPublicJSON() } });
});

// GET /api/study/documents
const listDocuments = asyncHandler(async (req, res) => {
  const docs = await Document.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { documents: docs.map((d) => d.toPublicJSON()) } });
});

// GET /api/study/documents/:id
const getDocument = asyncHandler(async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.user._id);
  res.json({ success: true, data: { document: doc.toPublicJSON() } });
});

// DELETE /api/study/documents/:id
const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.user._id);

  await getProvider().deleteDocument(doc.providerFileId);
  await Promise.all([
    ChatSession.deleteMany({ document: doc._id }),
    StudyArtifact.deleteMany({ document: doc._id }),
    doc.deleteOne(),
  ]);

  res.json({ success: true, message: 'Document deleted' });
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

// GET /api/study/documents/:id/chat
const getChatSession = asyncHandler(async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.user._id);

  let session = await ChatSession.findOne({ document: doc._id, owner: req.user._id });
  if (!session) {
    session = await ChatSession.create({ document: doc._id, owner: req.user._id });
  }

  res.json({ success: true, data: { session: session.toPublicJSON() } });
});

/**
 * POST /api/study/documents/:id/chat
 *
 * Streams the answer back as Server-Sent Events so the UI can render tokens as
 * they arrive. Errors that happen *after* headers are sent can't become an HTTP
 * status, so they're delivered as an `error` event instead and the stream closed.
 */
const sendChatMessage = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    throw new ApiError(400, 'A question is required');
  }

  const doc = await ownedDocument(req.params.id, req.user._id);
  let session = await ChatSession.findOne({ document: doc._id, owner: req.user._id });
  if (!session) {
    session = await ChatSession.create({ document: doc._id, owner: req.user._id });
  }

  const history = session.messages.map((m) => ({ role: m.role, content: m.content }));

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
    const result = await getProvider().chat({
      providerFileId: doc.providerFileId,
      history,
      question: question.trim(),
      onDelta: (text) => send('delta', { text }),
    });

    session.messages.push({ role: 'user', content: question.trim() });
    session.messages.push({
      role: 'assistant',
      content: result.text,
      citations: result.citations,
    });
    await session.save();

    send('done', {
      text: result.text,
      citations: result.citations,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[study] chat failed:', error.message);
    send('error', {
      message: error.statusCode ? error.message : 'The AI request failed. Please try again.',
    });
  } finally {
    res.end();
  }
});

// ---------------------------------------------------------------------------
// Generated study aids
// ---------------------------------------------------------------------------

const generator = {
  quiz: (provider, doc, body) =>
    provider.generateQuiz({
      providerFileId: doc.providerFileId,
      count: Math.min(Math.max(Number(body.count) || 10, 1), 20),
      difficulty: body.difficulty || 'mixed',
    }),
  flashcards: (provider, doc, body) =>
    provider.generateFlashcards({
      providerFileId: doc.providerFileId,
      count: Math.min(Math.max(Number(body.count) || 12, 1), 30),
    }),
  notes: (provider, doc) => provider.generateNotes({ providerFileId: doc.providerFileId }),
};

// POST /api/study/documents/:id/:kind  (kind: quiz | flashcards | notes)
const generateArtifact = asyncHandler(async (req, res) => {
  const { kind } = req.params;
  if (!generator[kind]) {
    throw new ApiError(400, `Unknown study aid "${kind}"`);
  }

  const doc = await ownedDocument(req.params.id, req.user._id);
  const payload = await generator[kind](getProvider(), doc, req.body);

  const artifact = await StudyArtifact.create({
    owner: req.user._id,
    document: doc._id,
    kind,
    payload,
  });

  res.status(201).json({ success: true, data: { artifact: artifact.toPublicJSON() } });
});

// GET /api/study/documents/:id/artifacts
const listArtifacts = asyncHandler(async (req, res) => {
  const doc = await ownedDocument(req.params.id, req.user._id);
  const artifacts = await StudyArtifact.find({ document: doc._id }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { artifacts: artifacts.map((a) => a.toPublicJSON()) },
  });
});

// POST /api/study/explain
const explainTopic = asyncHandler(async (req, res) => {
  const { topic } = req.body;
  if (!topic || !topic.trim()) throw new ApiError(400, 'A topic is required');

  const result = await getProvider().explainTopic({ topic: topic.trim() });
  res.json({ success: true, data: result });
});

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  getChatSession,
  sendChatMessage,
  generateArtifact,
  listArtifacts,
  explainTopic,
};
