const Anthropic = require('@anthropic-ai/sdk');
const { toFile } = require('@anthropic-ai/sdk');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const ApiError = require('../utils/ApiError');
const prompts = require('./prompts');
const schemas = require('./schemas');

// Referencing an uploaded file as a document source is only available on the
// beta messages endpoint, and needs this beta flag on every call that touches it.
const FILES_BETA = 'files-api-2025-04-14';

// max_tokens caps thinking + visible text together. Thinking is on by default on
// Opus 5, so these are sized well above the expected answer length.
const MAX_TOKENS_STREAM = 32000;
const MAX_TOKENS_JSON = 16000;

let client;
const getClient = () => {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ApiError(
        503,
        'AI_PROVIDER is "anthropic" but ANTHROPIC_API_KEY is not set. Add it to server/.env, or set AI_PROVIDER=mock.',
      );
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
};

const model = () => process.env.ANTHROPIC_MODEL || 'claude-opus-5';

/**
 * The document block, reused across every call about a given file.
 * `cache_control` marks the end of the stable prefix so follow-up questions read
 * the cached document instead of re-paying full input price for it.
 */
const documentBlock = (fileId) => ({
  type: 'document',
  source: { type: 'file', file_id: fileId },
  citations: { enabled: true },
  cache_control: { type: 'ephemeral' },
});

/** Translate SDK/API failures into ApiErrors the client can render. */
const wrap = (error) => {
  if (error instanceof ApiError) return error;

  if (error instanceof Anthropic.RateLimitError) {
    return new ApiError(429, 'The AI service is rate limited right now. Try again shortly.');
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ApiError(502, 'The configured ANTHROPIC_API_KEY was rejected.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ApiError(504, 'Could not reach the AI service. Check your network connection.');
  }
  if (error instanceof Anthropic.APIError) {
    return new ApiError(502, `AI service error (${error.status}): ${error.message}`);
  }
  return error;
};

/**
 * A refusal arrives as a normal HTTP 200 with stop_reason "refusal" — reading
 * content[0] without checking would surface an empty or partial answer as if it
 * were a real one.
 */
const assertNotRefused = (message) => {
  if (message?.stop_reason === 'refusal') {
    const category = message.stop_details?.category;
    throw new ApiError(
      422,
      `The AI declined to answer this request${category ? ` (${category})` : ''}. Try rephrasing.`,
    );
  }
};

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

async function uploadDocument({ buffer, filename, mimeType }) {
  try {
    const uploaded = await getClient().beta.files.upload({
      file: await toFile(buffer, filename, { type: mimeType }),
      betas: [FILES_BETA],
    });
    return { providerFileId: uploaded.id };
  } catch (error) {
    throw wrap(error);
  }
}

async function deleteDocument(providerFileId) {
  try {
    await getClient().beta.files.delete(providerFileId, { betas: [FILES_BETA] });
  } catch (error) {
    // Deleting the remote copy is best-effort; never block the local delete.
    console.warn(`[ai] could not delete remote file ${providerFileId}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Pull page-level citations out of the response's text blocks. */
const extractCitations = (content = []) => {
  const seen = new Set();
  const out = [];
  for (const block of content) {
    if (block.type !== 'text' || !block.citations) continue;
    for (const c of block.citations) {
      const page = c.start_page_number ?? null;
      const quote = (c.cited_text || '').trim();
      const key = `${page}::${quote.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ page, quote: quote.slice(0, 300) });
    }
  }
  return out;
};

const textOf = (content = []) =>
  content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

/**
 * Ask a question about a document, streaming deltas out via `onDelta`.
 * `history` is prior [{role, content}] turns for this session.
 */
async function chat({ providerFileId, history = [], question, onDelta }) {
  try {
    // Full turn list for this session, oldest first.
    const turns = [...history.map((m) => ({ role: m.role, content: m.content })), {
      role: 'user',
      content: question,
    }];

    // The document is attached to the very first user turn rather than repeated
    // on each one: that keeps it at the front of the cached prefix, so every
    // follow-up question reads it from cache instead of re-uploading the tokens.
    const messages = turns.map((turn, i) =>
      i === 0
        ? {
            role: 'user',
            content: [documentBlock(providerFileId), { type: 'text', text: turn.content }],
          }
        : turn,
    );

    const stream = getClient().beta.messages.stream({
      model: model(),
      max_tokens: MAX_TOKENS_STREAM,
      betas: [FILES_BETA],
      system: prompts.STUDY_TUTOR,
      output_config: { effort: 'medium' },
      messages,
    });

    if (onDelta) {
      stream.on('text', (delta) => onDelta(delta));
    }

    const message = await stream.finalMessage();
    assertNotRefused(message);

    return {
      text: textOf(message.content),
      citations: extractCitations(message.content),
      usage: {
        input_tokens: message.usage?.input_tokens ?? 0,
        output_tokens: message.usage?.output_tokens ?? 0,
        cache_read_input_tokens: message.usage?.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: message.usage?.cache_creation_input_tokens ?? 0,
      },
    };
  } catch (error) {
    throw wrap(error);
  }
}

// ---------------------------------------------------------------------------
// Structured generation
// ---------------------------------------------------------------------------

/** Run a document-grounded request that must return JSON matching `schema`. */
async function parseFromDocument({ providerFileId, system, instruction, schema, schemaName }) {
  try {
    const message = await getClient().beta.messages.parse({
      model: model(),
      max_tokens: MAX_TOKENS_JSON,
      betas: [FILES_BETA],
      system,
      output_config: { effort: 'medium', format: zodOutputFormat(schema, schemaName) },
      messages: [
        {
          role: 'user',
          content: [documentBlock(providerFileId), { type: 'text', text: instruction }],
        },
      ],
    });

    assertNotRefused(message);

    if (!message.parsed_output) {
      throw new ApiError(502, 'The AI returned a response that did not match the expected format.');
    }
    return message.parsed_output;
  } catch (error) {
    throw wrap(error);
  }
}

async function generateQuiz({ providerFileId, count = 10, difficulty = 'mixed' }) {
  return parseFromDocument({
    providerFileId,
    system: prompts.QUIZ_AUTHOR,
    instruction: `Write exactly ${count} multiple-choice questions from this document. Difficulty: ${difficulty}.`,
    schema: schemas.quizSchema,
    schemaName: 'quiz',
  });
}

async function generateFlashcards({ providerFileId, count = 12 }) {
  return parseFromDocument({
    providerFileId,
    system: prompts.FLASHCARD_AUTHOR,
    instruction: `Write exactly ${count} flashcards covering the most important material in this document.`,
    schema: schemas.flashcardsSchema,
    schemaName: 'flashcards',
  });
}

async function generateNotes({ providerFileId }) {
  return parseFromDocument({
    providerFileId,
    system: prompts.NOTES_AUTHOR,
    instruction: 'Turn this document into structured revision notes.',
    schema: schemas.notesSchema,
    schemaName: 'notes',
  });
}

async function explainTopic({ topic }) {
  try {
    const message = await getClient().messages.create({
      model: model(),
      max_tokens: MAX_TOKENS_JSON,
      system: prompts.TOPIC_EXPLAINER,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: `Explain: ${topic}` }],
    });
    assertNotRefused(message);
    return { text: textOf(message.content) };
  } catch (error) {
    throw wrap(error);
  }
}

// ---------------------------------------------------------------------------
// Career Hub
// ---------------------------------------------------------------------------

/**
 * Structured generation with no attached document — the Career Hub works from
 * text the user has already given us (profile, resume, job description) rather
 * than an uploaded file, so there is nothing to cache and no Files beta needed.
 */
async function parseJSON({ system, prompt, schema, schemaName, effort = 'medium' }) {
  try {
    const message = await getClient().messages.parse({
      model: model(),
      max_tokens: MAX_TOKENS_JSON,
      system,
      output_config: { effort, format: zodOutputFormat(schema, schemaName) },
      messages: [{ role: 'user', content: prompt }],
    });

    assertNotRefused(message);

    if (!message.parsed_output) {
      throw new ApiError(502, 'The AI returned a response that did not match the expected format.');
    }
    return message.parsed_output;
  } catch (error) {
    throw wrap(error);
  }
}

async function analyzeResume({ resumeText, jobDescription, targetRole }) {
  return parseJSON({
    system: prompts.RESUME_ANALYST,
    prompt: [
      `Target role: ${targetRole || 'not specified'}`,
      '',
      'JOB DESCRIPTION',
      jobDescription || '(none supplied — review the resume on its own merits and leave keyword lists empty)',
      '',
      'RESUME',
      resumeText,
    ].join('\n'),
    schema: schemas.atsAnalysisSchema,
    schemaName: 'ats_analysis',
  });
}

async function analyzeSkillGap({ targetRole, profileText }) {
  return parseJSON({
    system: prompts.SKILL_GAP_ANALYST,
    prompt: [`Target role: ${targetRole}`, '', 'STUDENT PROFILE', profileText].join('\n'),
    schema: schemas.skillGapSchema,
    schemaName: 'skill_gap',
  });
}

async function generateRoadmap({ goal, weeks, hoursPerWeek, profileText }) {
  return parseJSON({
    system: prompts.ROADMAP_AUTHOR,
    prompt: [
      `Goal: ${goal}`,
      `Time budget: ${weeks} weeks at roughly ${hoursPerWeek} hours per week.`,
      'The phase durations must add up to about that many weeks.',
      '',
      'STUDENT PROFILE',
      profileText,
    ].join('\n'),
    schema: schemas.roadmapSchema,
    schemaName: 'roadmap',
  });
}

async function generateCompanyPrep({ company, role }) {
  return parseJSON({
    system: prompts.COMPANY_PREP,
    prompt: `Company: ${company}\nRole: ${role}`,
    schema: schemas.companyPrepSchema,
    schemaName: 'company_prep',
  });
}

async function generateInterviewQuestions({ role, level, focus, count }) {
  return parseJSON({
    system: prompts.INTERVIEWER,
    prompt: [
      `Role: ${role}`,
      `Candidate level: ${level}`,
      focus ? `Weight the questions towards: ${focus}` : '',
      `Write exactly ${count} questions.`,
    ]
      .filter(Boolean)
      .join('\n'),
    schema: schemas.interviewQuestionsSchema,
    schemaName: 'interview_questions',
  });
}

async function gradeInterview({ role, level, questions }) {
  const transcript = questions
    .map(
      (q, i) =>
        `Q${i} [${q.category}] ${q.prompt}\nStrong answer covers: ${q.whatGoodLooksLike}\nCandidate answered: ${
          q.answer?.trim() ? q.answer : '(no answer given)'
        }`,
    )
    .join('\n\n');

  return parseJSON({
    system: prompts.INTERVIEW_GRADER,
    prompt: `Role: ${role}\nLevel: ${level}\n\n${transcript}`,
    schema: schemas.interviewFeedbackSchema,
    schemaName: 'interview_feedback',
  });
}

// ---------------------------------------------------------------------------
// Mentorship
// ---------------------------------------------------------------------------

async function matchMentors({ profileText, mentors, goal }) {
  const candidates = mentors
    .map((m) =>
      [
        `mentorId: ${m.id}`,
        `name: ${m.name}`,
        `headline: ${m.headline}`,
        `role: ${[m.currentRole, m.organisation].filter(Boolean).join(' at ')}`,
        `expertise: ${m.expertise.join(', ')}`,
        `years of experience: ${m.yearsExperience}`,
        `rating: ${m.ratingCount ? `${m.ratingAverage.toFixed(1)} from ${m.ratingCount} reviews` : 'not yet rated'}`,
        `bio: ${m.bio}`,
      ].join('\n'),
    )
    .join('\n---\n');

  return parseJSON({
    system: prompts.MENTOR_MATCHER,
    prompt: [
      'STUDENT PROFILE',
      profileText,
      goal ? `\nWhat they want help with right now: ${goal}` : '',
      '\nCANDIDATE MENTORS',
      candidates,
    ].join('\n'),
    schema: schemas.mentorMatchSchema,
    schemaName: 'mentor_match',
    effort: 'low',
  });
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

async function recommendOpportunities({ profileText, opportunities }) {
  const candidates = opportunities
    .map((o) =>
      [
        `opportunityId: ${o.id}`,
        `type: ${o.type}`,
        `title: ${o.title}`,
        `organisation: ${o.organisation}`,
        `location: ${o.isRemote ? 'Remote' : o.location || 'not stated'}`,
        o.reward ? `reward: ${o.reward}` : '',
        o.deadline ? `closes in ${o.daysLeft} days` : 'no stated deadline',
        o.eligibility ? `eligibility: ${o.eligibility}` : '',
        o.tags.length ? `tags: ${o.tags.join(', ')}` : '',
        `description: ${o.description.slice(0, 600)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n---\n');

  return parseJSON({
    system: prompts.OPPORTUNITY_SCOUT,
    prompt: ['STUDENT PROFILE', profileText, '', 'CANDIDATE OPPORTUNITIES', candidates].join('\n'),
    schema: schemas.opportunityPicksSchema,
    schemaName: 'opportunity_picks',
    effort: 'low',
  });
}

// ---------------------------------------------------------------------------
// Wellbeing
// ---------------------------------------------------------------------------

/**
 * `logText` is built from the numeric log only. The free-text note a student
 * writes against a day is deliberately never included — see the note in
 * wellbeing.controller.js.
 */
async function generateWellbeingCheckin({ logText, supportContext }) {
  return parseJSON({
    system: prompts.WELLBEING_COACH,
    prompt: [
      'WELLBEING LOG (the student wrote these themselves)',
      logText,
      supportContext ? `\nSUPPORT CONTACT AVAILABLE TO THIS STUDENT\n${supportContext}` : '',
      '\nIf you name a service, use only the contact above. If none was given, refer to kinds of people rather than named services.',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: schemas.wellbeingCheckinSchema,
    schemaName: 'wellbeing_checkin',
  });
}

// ---------------------------------------------------------------------------
// AI Mentor
// ---------------------------------------------------------------------------

async function generateDailyBrief({ profileText, goalsText, activityText, today }) {
  return parseJSON({
    system: prompts.MENTOR_BRIEFER,
    // The date belongs in the message rather than the system prompt: prompts.js
    // has to stay byte-stable for caching, and this changes every day.
    prompt: [
      `Today is ${today}.`,
      '',
      'STUDENT PROFILE',
      profileText,
      '',
      'TRACKED GOALS',
      goalsText,
      '',
      'ACTIVITY IN THE APP (these are real counts — treat them as facts)',
      activityText,
    ].join('\n'),
    schema: schemas.dailyBriefSchema,
    schemaName: 'daily_brief',
  });
}

async function generateStudyPlan({ profileText, topic, weeks, hoursPerWeek, contextText }) {
  return parseJSON({
    system: prompts.STUDY_PLANNER,
    prompt: [
      `Topic or goal: ${topic}`,
      `Time budget: ${weeks} weeks at roughly ${hoursPerWeek} hours per week.`,
      'Produce exactly one entry in weeks[] per week of that budget.',
      '',
      'STUDENT PROFILE',
      profileText,
      contextText ? `\nMATERIAL THEY ALREADY HAVE\n${contextText}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: schemas.studyPlanSchema,
    schemaName: 'study_plan',
  });
}

// ---------------------------------------------------------------------------
// Resource Library
// ---------------------------------------------------------------------------

async function recommendResources({ profileText, goal, resources }) {
  const candidates = resources
    .map((r) =>
      [
        `resourceId: ${r.id}`,
        `type: ${r.type}`,
        `title: ${r.title}`,
        r.subject ? `subject: ${r.subject}` : '',
        r.tags.length ? `tags: ${r.tags.join(', ')}` : '',
        `format: ${r.hasFile ? 'downloadable file' : 'external link'}`,
        `community score: ${r.score}`,
        r.description ? `description: ${r.description.slice(0, 500)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n---\n');

  return parseJSON({
    system: prompts.RESOURCE_CURATOR,
    prompt: [
      'STUDENT PROFILE',
      profileText,
      goal ? `\nWhat they are trying to do right now: ${goal}` : '',
      '\nCANDIDATE RESOURCES',
      candidates,
    ].join('\n'),
    schema: schemas.resourcePicksSchema,
    schemaName: 'resource_picks',
    effort: 'low',
  });
}

// ---------------------------------------------------------------------------
// Project Marketplace
// ---------------------------------------------------------------------------

async function generateProjectIdeas({ profileText, brief, count }) {
  return parseJSON({
    system: prompts.PROJECT_IDEATOR,
    prompt: [
      'STUDENT PROFILE',
      profileText,
      brief ? `\nWhat they want to build around: ${brief}` : '',
      `\nPropose exactly ${count} ideas.`,
    ]
      .filter(Boolean)
      .join('\n'),
    schema: schemas.projectIdeasSchema,
    schemaName: 'project_ideas',
  });
}

/** Career guidance chat. Streams like the study tutor but has no document. */
async function careerChat({ profileText, history = [], question, onDelta }) {
  try {
    const turns = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: question },
    ];

    // The profile is variable per user, so it belongs in the first message turn
    // rather than the system prompt, which has to stay byte-stable for caching.
    const messages = turns.map((turn, i) =>
      i === 0
        ? { role: 'user', content: `STUDENT PROFILE\n${profileText}\n\n---\n\n${turn.content}` }
        : turn,
    );

    const stream = getClient().messages.stream({
      model: model(),
      max_tokens: MAX_TOKENS_STREAM,
      system: prompts.CAREER_COACH,
      output_config: { effort: 'medium' },
      messages,
    });

    if (onDelta) {
      stream.on('text', (delta) => onDelta(delta));
    }

    const message = await stream.finalMessage();
    assertNotRefused(message);

    return {
      text: textOf(message.content),
      usage: {
        input_tokens: message.usage?.input_tokens ?? 0,
        output_tokens: message.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    throw wrap(error);
  }
}

async function summarizeDiscussion({ thread }) {
  try {
    const transcript = [
      `Title: ${thread.title}`,
      `Original post: ${thread.body}`,
      '',
      'Comments:',
      ...thread.comments.map((c, i) => `${i + 1}. ${c.author}: ${c.body}`),
    ].join('\n');

    const message = await getClient().messages.parse({
      model: model(),
      max_tokens: MAX_TOKENS_JSON,
      system: prompts.DISCUSSION_SUMMARIZER,
      output_config: {
        effort: 'low',
        format: zodOutputFormat(schemas.discussionSummarySchema, 'discussion_summary'),
      },
      messages: [{ role: 'user', content: transcript }],
    });

    assertNotRefused(message);
    if (!message.parsed_output) {
      throw new ApiError(502, 'The AI returned a response that did not match the expected format.');
    }
    return message.parsed_output;
  } catch (error) {
    throw wrap(error);
  }
}

module.exports = {
  name: 'anthropic',
  uploadDocument,
  deleteDocument,
  chat,
  generateQuiz,
  generateFlashcards,
  generateNotes,
  explainTopic,
  summarizeDiscussion,
  analyzeResume,
  analyzeSkillGap,
  generateRoadmap,
  generateCompanyPrep,
  generateInterviewQuestions,
  gradeInterview,
  careerChat,
  matchMentors,
  recommendOpportunities,
  recommendResources,
  generateProjectIdeas,
  generateDailyBrief,
  generateStudyPlan,
  generateWellbeingCheckin,
};
