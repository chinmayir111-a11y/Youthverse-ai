const { z } = require('zod');

// Structured-output schemas. Kept deliberately flat: the structured-output
// engine does not support recursive schemas or numeric/length constraints,
// so bounds are enforced in the prompt and validated after parsing.

const quizSchema = z.object({
  title: z.string().describe('Short title for this quiz, drawn from the source material'),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).describe('Exactly 4 answer options'),
        correctIndex: z
          .number()
          .int()
          .describe('0-based index into options of the correct answer'),
        explanation: z.string().describe('Why the correct answer is right, one or two sentences'),
        sourcePage: z
          .number()
          .int()
          .nullable()
          .describe('1-based page of the source document this came from, or null'),
      }),
    )
    .describe('The quiz questions'),
});

const flashcardsSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe('The prompt side: a term, question, or concept'),
      back: z.string().describe('The answer side, concise'),
      sourcePage: z.number().int().nullable(),
    }),
  ),
});

const notesSchema = z.object({
  title: z.string(),
  summary: z.string().describe('A 2-3 sentence overview of the document'),
  sections: z.array(
    z.object({
      heading: z.string(),
      points: z.array(z.string()).describe('Key bullet points for this section'),
    }),
  ),
  keyTerms: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
});

const discussionSummarySchema = z.object({
  summary: z.string().describe('A neutral 2-4 sentence summary of the discussion so far'),
  keyPoints: z.array(z.string()).describe('The distinct substantive points raised'),
  openQuestions: z.array(z.string()).describe('Questions raised but not yet answered'),
});

// --- Career Hub -------------------------------------------------------------

const atsAnalysisSchema = z.object({
  score: z
    .number()
    .int()
    .describe('ATS match score from 0 to 100 for this resume against this job description'),
  verdict: z.string().describe('One sentence on whether this resume would clear a screen'),
  matchedKeywords: z
    .array(z.string())
    .describe('Terms from the job description that already appear in the resume'),
  missingKeywords: z
    .array(z.string())
    .describe('Terms the job description emphasises that the resume never mentions'),
  formattingIssues: z
    .array(z.string())
    .describe('Things that would confuse an automated parser, or an empty list if none'),
  sectionFeedback: z.array(
    z.object({
      section: z.string().describe('Which resume section this is about'),
      issue: z.string(),
      fix: z.string().describe('A concrete rewrite or addition, not generic advice'),
    }),
  ),
  strengths: z.array(z.string()).describe('What already works, so the student keeps it'),
  rewrites: z
    .array(
      z.object({
        original: z.string().describe('A bullet copied verbatim from the resume'),
        improved: z.string().describe('The same bullet rewritten with impact and metrics'),
      }),
    )
    .describe('Line-level rewrites of the weakest bullets'),
});

const skillGapSchema = z.object({
  targetRole: z.string(),
  readiness: z
    .number()
    .int()
    .describe('0-100 estimate of how ready this student is for the target role today'),
  summary: z.string().describe('Two or three sentences on where they stand'),
  strengths: z.array(z.string()).describe("Skills they already have that the role wants"),
  gaps: z.array(
    z.object({
      skill: z.string(),
      importance: z.enum(['critical', 'important', 'nice-to-have']),
      whyItMatters: z.string().describe('What the role actually uses this for'),
      howToClose: z.string().describe('A specific first action, not "learn X"'),
    }),
  ),
  nextSteps: z.array(z.string()).describe('The three or four things to do first, in order'),
});

const roadmapSchema = z.object({
  title: z.string(),
  targetRole: z.string(),
  summary: z.string().describe('What this roadmap gets them to, and roughly when'),
  phases: z.array(
    z.object({
      name: z.string(),
      durationWeeks: z.number().int(),
      focus: z.string().describe('One line on what this phase is for'),
      milestones: z.array(
        z.object({
          title: z.string().describe('A checkable outcome, e.g. "Ship a REST API with auth"'),
          detail: z.string(),
          resource: z.string().describe('A named book, course, doc, or project idea'),
        }),
      ),
    }),
  ),
});

const companyPrepSchema = z.object({
  company: z.string(),
  role: z.string(),
  overview: z.string().describe('What this company builds and how it hires, in a short paragraph'),
  interviewProcess: z.array(
    z.object({
      stage: z.string().describe('e.g. "Online assessment", "System design round"'),
      whatToExpect: z.string(),
      howToPrepare: z.string(),
    }),
  ),
  focusTopics: z.array(z.string()).describe('Technical topics worth the most study time'),
  likelyQuestions: z.array(
    z.object({
      question: z.string(),
      whatTheyAreLookingFor: z.string(),
    }),
  ),
  questionsToAsk: z.array(z.string()).describe('Good questions for the candidate to ask'),
  caveat: z
    .string()
    .describe('State plainly that hiring processes change and this is a general guide'),
});

const interviewQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      category: z
        .string()
        .describe('e.g. behavioural, technical, system design, role-specific'),
      whatGoodLooksLike: z.string().describe('What a strong answer covers'),
    }),
  ),
});

const interviewFeedbackSchema = z.object({
  overallScore: z.number().int().describe('0-100 across the whole interview'),
  summary: z.string().describe('Two or three sentences of honest overall feedback'),
  perQuestion: z.array(
    z.object({
      index: z.number().int().describe('0-based index of the question being graded'),
      score: z.number().int().describe('0-10 for this answer'),
      strengths: z.string(),
      improvements: z.string(),
      modelAnswer: z.string().describe('A short example of a strong answer'),
    }),
  ),
  nextSteps: z.array(z.string()),
});

// --- Mentorship -------------------------------------------------------------

const mentorMatchSchema = z.object({
  matches: z.array(
    z.object({
      mentorId: z
        .string()
        .describe('The id of the mentor being recommended, copied exactly from the candidate list'),
      fit: z.number().int().describe('0-100 how well this mentor fits this student right now'),
      why: z.string().describe('What specifically about this mentor matches this student'),
      askThemAbout: z
        .string()
        .describe('A concrete first question this student should bring to them'),
    }),
  ),
  noteToStudent: z
    .string()
    .describe('One line on how to use these matches, or on what the profile is missing'),
});

// --- Opportunities ----------------------------------------------------------

const opportunityPicksSchema = z.object({
  picks: z.array(
    z.object({
      opportunityId: z
        .string()
        .describe('The id of the opportunity, copied exactly from the candidate list'),
      fit: z.number().int().describe('0-100 how well this suits this student'),
      why: z.string().describe('What about this student makes this one worth their time'),
      watchOut: z
        .string()
        .describe('The eligibility catch or effort cost they should check before applying'),
    }),
  ),
  noteToStudent: z
    .string()
    .describe('One line on the shortlist overall, or on what the profile is missing'),
});

// --- Wellbeing -------------------------------------------------------------

const wellbeingCheckinSchema = z.object({
  observation: z
    .string()
    .describe('What the last couple of weeks actually show, said plainly and without spin'),
  pattern: z
    .string()
    .describe(
      'One link between two things in the data they may not have noticed, or a plain statement that there is not enough data yet to see one',
    ),
  suggestions: z
    .array(
      z.object({
        title: z.string().describe('One small, concrete change'),
        why: z.string().describe('What in their data suggests it'),
        effort: z.enum(['tiny', 'small', 'medium']),
      }),
    )
    .describe('Two or three suggestions, smallest first'),
  reachOut: z
    .string()
    .describe(
      'Whether talking to a person would help more than any change here, and who that might be. Never a diagnosis and never a specific service you were not given.',
    ),
  note: z.string().describe('One closing sentence. Honest, not cheerful.'),
});

// --- AI Mentor -------------------------------------------------------------

const dailyBriefSchema = z.object({
  headline: z.string().describe("One line on what today is for, specific to this student"),
  focus: z.string().describe('The single thing that matters most today, and why it is that'),
  actions: z
    .array(
      z.object({
        title: z.string().describe('A concrete action, small enough to finish today'),
        why: z.string().describe('What this moves — tie it to a goal or a deadline they have'),
        module: z
          .string()
          .describe('Where in YouthVerse this happens: study, career, projects, resources, community, mentorship, or none'),
        minutes: z.number().int().describe('Realistic minutes this takes'),
      }),
    )
    .describe('Three to five actions for today, ordered by what to do first'),
  careerAdvice: z
    .string()
    .describe('One piece of career advice grounded in where this student actually is'),
  watchOut: z
    .string()
    .describe('The deadline, gap, or stalled goal they are most likely to be ignoring'),
  encouragement: z.string().describe('One honest sentence — earned, not flattery'),
});

const studyPlanSchema = z.object({
  title: z.string(),
  summary: z.string().describe('What this plan gets them to, and by when'),
  weeks: z.array(
    z.object({
      focus: z.string().describe('What this week is for, in one line'),
      tasks: z.array(
        z.object({
          title: z.string().describe('A checkable task, not an activity'),
          detail: z.string().describe('What doing it actually involves'),
          hours: z.number().int().describe('Rough hours this task takes'),
        }),
      ),
      checkpoint: z
        .string()
        .describe('How they know the week worked — something they can test themselves on'),
    }),
  ),
  ifBehind: z
    .string()
    .describe('What to cut first if they fall behind, so the plan degrades sensibly'),
});

// --- Resource Library ------------------------------------------------------

const resourcePicksSchema = z.object({
  picks: z.array(
    z.object({
      resourceId: z
        .string()
        .describe('The id of the resource, copied exactly from the candidate list'),
      relevance: z.number().int().describe('0-100 how useful this is to this student now'),
      why: z.string().describe('What about this student makes this one worth opening'),
      howToUse: z.string().describe('A concrete way to work through it, not "read it"'),
    }),
  ),
  noteToStudent: z
    .string()
    .describe('One line on the shortlist overall, or on what the library is missing'),
});

// --- Project Marketplace ---------------------------------------------------

const projectIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      tagline: z.string().describe('One line on what it does, as it would read on a card'),
      problem: z.string().describe('The specific problem this solves, and for whom'),
      description: z.string().describe('What actually gets built, in a short paragraph'),
      tech: z.array(z.string()).describe('The stack to build it with'),
      rolesNeeded: z
        .array(z.string())
        .describe('Roles a team would need to fill, or an empty list if one person can build it'),
      firstMilestone: z
        .string()
        .describe('The smallest version worth shipping, reachable in a weekend'),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      weeks: z.number().int().describe('Rough weeks to a working version'),
    }),
  ),
  noteToStudent: z
    .string()
    .describe('One line on how to choose between these, or on what the profile is missing'),
});

module.exports = {
  quizSchema,
  flashcardsSchema,
  notesSchema,
  discussionSummarySchema,
  atsAnalysisSchema,
  skillGapSchema,
  roadmapSchema,
  companyPrepSchema,
  interviewQuestionsSchema,
  interviewFeedbackSchema,
  mentorMatchSchema,
  opportunityPicksSchema,
  projectIdeasSchema,
  resourcePicksSchema,
  dailyBriefSchema,
  studyPlanSchema,
  wellbeingCheckinSchema,
};
