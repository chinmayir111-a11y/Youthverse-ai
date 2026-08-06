// Deterministic stand-in for the Anthropic provider.
//
// This exists so the whole app — upload, chat, quiz, flashcards — is runnable
// and testable with no API key and no network. It is selected by AI_PROVIDER=mock.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MOCK_NOTICE =
  '_(Mock AI provider. Set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in server/.env for real answers.)_';

async function uploadDocument({ filename }) {
  await sleep(50);
  return { providerFileId: `mock-file-${Date.now()}-${filename.replace(/\W+/g, '-')}` };
}

async function deleteDocument() {
  /* nothing to clean up */
}

async function chat({ question, onDelta }) {
  const reply =
    `Here's what I found on "${question.slice(0, 80)}".\n\n` +
    `The document introduces the core idea, then works through an example before ` +
    `generalising it. The key thing to hold onto is that the definition constrains ` +
    `which cases the result applies to.\n\n${MOCK_NOTICE}`;

  // Emit in chunks so the client's streaming path is genuinely exercised.
  if (onDelta) {
    for (const word of reply.split(' ')) {
      onDelta(word + ' ');
      await sleep(12);
    }
  }

  return {
    text: reply,
    citations: [
      { page: 1, quote: 'the core idea is introduced on the opening page' },
      { page: 3, quote: 'a worked example follows' },
    ],
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 },
  };
}

async function generateQuiz({ count = 5 }) {
  await sleep(120);
  return {
    title: 'Sample Quiz (mock)',
    questions: Array.from({ length: count }, (_, i) => ({
      question: `Mock question ${i + 1}: which statement best matches the source material?`,
      options: [
        'The correct statement, grounded in the document',
        'A plausible but incomplete statement',
        'A statement that reverses the relationship',
        'A statement about an unrelated topic',
      ],
      correctIndex: 0,
      explanation: 'Option 1 restates the definition given in the document without overreaching.',
      sourcePage: (i % 4) + 1,
    })),
  };
}

async function generateFlashcards({ count = 8 }) {
  await sleep(120);
  return {
    cards: Array.from({ length: count }, (_, i) => ({
      front: `Mock term ${i + 1}`,
      back: `The definition of mock term ${i + 1}, as given in the source document.`,
      sourcePage: (i % 5) + 1,
    })),
  };
}

async function generateNotes() {
  await sleep(120);
  return {
    title: 'Revision Notes (mock)',
    summary:
      'A placeholder summary produced without calling a model. It stands in for the real overview so the UI can be built and tested offline.',
    sections: [
      {
        heading: 'Core concepts',
        points: [
          'The document opens by defining its central term.',
          'It then constrains that definition with two conditions.',
        ],
      },
      {
        heading: 'Worked example',
        points: ['A single example is carried through the middle section.'],
      },
    ],
    keyTerms: [
      { term: 'Mock term', definition: 'A placeholder used while no API key is configured.' },
    ],
  };
}

async function explainTopic({ topic }) {
  await sleep(100);
  return {
    text:
      `**${topic}** — in one line, this is the idea that lets you reason about the ` +
      `general case from a small number of concrete ones.\n\n${MOCK_NOTICE}`,
  };
}

async function summarizeDiscussion({ thread }) {
  await sleep(100);
  return {
    summary: `A mock summary of "${thread.title}". ${MOCK_NOTICE}`,
    keyPoints: ['A first substantive point raised in the thread.', 'A second, competing view.'],
    openQuestions: ['A question nobody in the thread answered.'],
  };
}

// --- Career Hub -------------------------------------------------------------

async function analyzeResume({ resumeText, jobDescription, targetRole }) {
  await sleep(120);
  // Scored off length so an empty resume doesn't come back looking strong —
  // the offline path should still behave like the real one directionally.
  const score = Math.min(90, 35 + Math.floor(resumeText.trim().length / 40));
  return {
    score,
    verdict:
      score < 50
        ? 'This resume is too thin to clear an automated screen as written.'
        : `A reasonable starting point for ${targetRole || 'this role'}, with gaps to close. ${MOCK_NOTICE}`,
    matchedKeywords: jobDescription ? ['communication', 'teamwork'] : [],
    missingKeywords: jobDescription ? ['CI/CD', 'unit testing', 'REST APIs'] : [],
    formattingIssues: ['Dates are not in a consistent format across entries.'],
    sectionFeedback: [
      {
        section: 'Experience',
        issue: 'Bullets describe duties rather than outcomes.',
        fix: 'Lead each bullet with the result: "Cut report generation from 6 minutes to 40 seconds by adding an index".',
      },
      {
        section: 'Skills',
        issue: 'The list mixes tools with concepts, so scanners weight them equally.',
        fix: 'Split into Languages, Frameworks, and Tools.',
      },
    ],
    strengths: ['Education section is complete and clearly dated.'],
    rewrites: [
      {
        original: 'Worked on the college website.',
        improved:
          'Rebuilt the college website front page in React, cutting first paint from 3.4s to 1.2s for ~2,000 monthly visitors.',
      },
    ],
  };
}

async function analyzeSkillGap({ targetRole }) {
  await sleep(120);
  return {
    targetRole,
    readiness: 58,
    summary: `A mock readiness estimate for ${targetRole}. ${MOCK_NOTICE}`,
    strengths: ['Comfortable with the language fundamentals the role assumes.'],
    gaps: [
      {
        skill: 'Automated testing',
        importance: 'critical',
        whyItMatters: 'Every team ships behind a test suite; you will be asked how you verify your work.',
        howToClose: 'Add unit tests to an existing project until the core module is covered.',
      },
      {
        skill: 'System design basics',
        importance: 'important',
        whyItMatters: 'Interviews at this level include a design discussion.',
        howToClose: 'Design and write up a URL shortener, then a rate limiter.',
      },
      {
        skill: 'Public writing',
        importance: 'nice-to-have',
        whyItMatters: 'A visible write-up gives an interviewer something to ask about.',
        howToClose: 'Publish one build log per project you finish.',
      },
    ],
    nextSteps: [
      'Pick one existing project and get it under test.',
      'Write up a system design for something you have already built.',
      'Apply to five roles to calibrate against real job descriptions.',
    ],
  };
}

async function generateRoadmap({ goal, weeks }) {
  await sleep(140);
  const phaseWeeks = Math.max(1, Math.round(weeks / 3));
  return {
    title: `Roadmap: ${goal}`,
    targetRole: goal,
    summary: `A mock ${weeks}-week plan towards "${goal}". ${MOCK_NOTICE}`,
    phases: [
      {
        name: 'Foundations',
        durationWeeks: phaseWeeks,
        focus: 'Close the fundamentals that everything later assumes.',
        milestones: [
          {
            title: 'Rebuild one core concept from scratch',
            detail: 'Implement it without a library so the edge cases are yours to hit.',
            resource: 'The official language documentation',
          },
          {
            title: 'Ship a small tool you personally use',
            detail: 'Scope it to a weekend so it actually gets finished.',
            resource: 'Your own workflow — pick the most annoying manual step',
          },
        ],
      },
      {
        name: 'Depth',
        durationWeeks: phaseWeeks,
        focus: 'Go one level below the abstractions you already use.',
        milestones: [
          {
            title: 'Deploy a service with authentication and tests',
            detail: 'End to end: database, API, deploy pipeline.',
            resource: 'A cloud provider free tier',
          },
        ],
      },
      {
        name: 'Proof',
        durationWeeks: weeks - phaseWeeks * 2,
        focus: 'Turn the work into something a hiring manager can evaluate.',
        milestones: [
          {
            title: 'Publish a write-up of your hardest bug',
            detail: 'Cause, diagnosis, fix, and what you changed to prevent it.',
            resource: 'Any blogging platform',
          },
          {
            title: 'Run three mock interviews',
            detail: 'Record them and grade your own answers before reading feedback.',
            resource: 'The Mock Interview tool in this app',
          },
        ],
      },
    ],
  };
}

async function generateCompanyPrep({ company, role }) {
  await sleep(120);
  return {
    company,
    role,
    overview: `A mock preparation brief for ${role} at ${company}. ${MOCK_NOTICE}`,
    interviewProcess: [
      {
        stage: 'Online assessment',
        whatToExpect: 'Two timed problems, typically data structures and string handling.',
        howToPrepare: 'Practise under a clock; untimed practice hides the real failure mode.',
      },
      {
        stage: 'Technical round',
        whatToExpect: 'One problem, discussed aloud, with follow-ups on complexity.',
        howToPrepare: 'Narrate your reasoning while solving, not after.',
      },
      {
        stage: 'Hiring manager round',
        whatToExpect: 'Project deep-dive and motivation questions.',
        howToPrepare: 'Be able to justify one technical decision you would now make differently.',
      },
    ],
    focusTopics: ['Arrays and hashing', 'Time and space complexity', 'Your own projects, in detail'],
    likelyQuestions: [
      {
        question: 'Walk me through a project you are proud of.',
        whatTheyAreLookingFor: 'Whether you can separate what you did from what the team did.',
      },
      {
        question: 'Tell me about something that broke in production.',
        whatTheyAreLookingFor: 'Diagnosis process and honesty, not a blameless story.',
      },
    ],
    questionsToAsk: [
      'What does the first 90 days look like for this role?',
      'How does the team decide what to work on next?',
    ],
    caveat:
      'Hiring processes change often and vary by team and location. Treat this as a general guide, not insider information.',
  };
}

async function generateInterviewQuestions({ role, count = 5 }) {
  await sleep(120);
  const categories = ['behavioural', 'technical', 'scenario'];
  return {
    questions: Array.from({ length: count }, (_, i) => ({
      prompt: `Mock question ${i + 1} for a ${role}: describe how you would approach a problem in this area.`,
      category: categories[i % categories.length],
      whatGoodLooksLike:
        'A specific example with your own actions, the trade-off you made, and the measurable outcome.',
    })),
  };
}

async function gradeInterview({ questions }) {
  await sleep(140);
  const perQuestion = questions.map((q, i) => {
    const answered = Boolean(q.answer && q.answer.trim());
    return {
      index: i,
      score: answered ? Math.min(9, 4 + Math.floor(q.answer.trim().length / 60)) : 0,
      strengths: answered ? 'You answered the question that was actually asked.' : 'No answer given.',
      improvements: answered
        ? 'Add the outcome. An example without a result reads as an anecdote.'
        : 'Answer it — even a rough answer beats silence in a real interview.',
      modelAnswer:
        'Situation in one line, your specific action, the trade-off you weighed, the measurable result.',
    };
  });
  const answered = perQuestion.filter((p) => p.score > 0);
  return {
    overallScore: answered.length
      ? Math.round((answered.reduce((s, p) => s + p.score, 0) / (perQuestion.length * 10)) * 100)
      : 0,
    summary: `A mock grading pass over ${questions.length} answers. ${MOCK_NOTICE}`,
    perQuestion,
    nextSteps: [
      'Rewrite your weakest answer using situation → action → result.',
      'Re-run this interview and compare the scores.',
    ],
  };
}

async function careerChat({ question, onDelta }) {
  const reply =
    `On "${question.slice(0, 80)}" — the short answer is that the next concrete step matters more ` +
    `than the long-term plan. Pick the smallest thing you can finish this week that produces evidence ` +
    `someone else can look at, then decide the step after that.\n\n${MOCK_NOTICE}`;

  if (onDelta) {
    for (const word of reply.split(' ')) {
      onDelta(word + ' ');
      await sleep(10);
    }
  }

  return { text: reply, usage: { input_tokens: 0, output_tokens: 0 } };
}

// --- Mentorship -------------------------------------------------------------

async function matchMentors({ mentors, goal }) {
  await sleep(120);
  // Ranked by how much expertise a mentor lists, so the ordering is at least
  // deterministic and non-arbitrary while running offline.
  const ranked = [...mentors].sort((a, b) => b.expertise.length - a.expertise.length).slice(0, 3);

  return {
    matches: ranked.map((m, i) => ({
      mentorId: m.id,
      fit: 88 - i * 11,
      why: `${m.name} lists ${m.expertise.slice(0, 2).join(' and ') || 'relevant experience'}, which lines up with what you are working towards.`,
      askThemAbout: goal
        ? `How they would approach "${goal}" from where you are now.`
        : 'What they would do differently if they were starting again today.',
    })),
    noteToStudent: `A mock ranking over ${mentors.length} mentors. ${MOCK_NOTICE}`,
  };
}

// --- Opportunities ----------------------------------------------------------

async function recommendOpportunities({ opportunities }) {
  await sleep(120);
  // Soonest deadline first, so the offline ordering is deterministic and at
  // least defensible rather than arbitrary.
  const ranked = [...opportunities]
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
    .slice(0, 4);

  return {
    picks: ranked.map((o, i) => ({
      opportunityId: o.id,
      fit: 90 - i * 9,
      why: `A ${o.type} at ${o.organisation} that lines up with what you have been working on.`,
      watchOut:
        o.daysLeft !== null && o.daysLeft <= 7
          ? `Closes in ${o.daysLeft} day${o.daysLeft === 1 ? '' : 's'} — start today or skip it.`
          : 'Check the eligibility line before you spend an evening on the application.',
    })),
    noteToStudent: `A mock shortlist over ${opportunities.length} open listings. ${MOCK_NOTICE}`,
  };
}

// --- Wellbeing --------------------------------------------------------------

async function generateWellbeingCheckin({ stats = {} }) {
  await sleep(120);
  const { entries = 0, averageMood = null, lowDays = 0, averageSleep = null } = stats;

  if (entries < 3) {
    return {
      observation: `Only ${entries} ${entries === 1 ? 'day is' : 'days are'} logged so far.`,
      pattern: 'Not enough yet to see a pattern — a couple of weeks would give this something to work with.',
      suggestions: [
        {
          title: 'Log a mood for a few days running',
          why: 'A single day says almost nothing; a run of them starts to.',
          effort: 'tiny',
        },
      ],
      reachOut:
        'Nothing here suggests anything is wrong. If something is, a person you trust is a better first step than an app.',
      note: `Kept short because there is little to go on. ${MOCK_NOTICE}`,
    };
  }

  return {
    observation:
      `Across ${entries} logged days your mood averages ${averageMood}/5` +
      (lowDays ? `, with ${lowDays} day${lowDays === 1 ? '' : 's'} at 2 or below.` : '.'),
    pattern:
      averageSleep !== null
        ? `Sleep is averaging ${averageSleep} hours. Where the low days cluster, the short nights tend to be nearby.`
        : 'No sleep logged, so there is nothing to line the mood days up against yet.',
    suggestions: [
      {
        title: 'Put a rough bedtime on the two busiest days this week',
        why: 'Those are the days the log shows slipping first.',
        effort: 'small',
      },
      {
        title: 'Log the factor as well as the number',
        why: 'The number tells you a day was hard; the factor is what you can act on.',
        effort: 'tiny',
      },
    ],
    reachOut:
      lowDays >= 4
        ? 'This looks like more than one hard week. Talking to someone — a person you trust, or your institution’s counselling service — will do more than anything on this page.'
        : 'Nothing here needs escalating. If it starts feeling like more than a bad week, talk to someone rather than waiting it out.',
    note: `A mock reading of your own log. ${MOCK_NOTICE}`,
  };
}

// --- AI Mentor --------------------------------------------------------------

async function generateDailyBrief({ goals = [], activity = {} }) {
  await sleep(140);
  const open = goals.filter((g) => g.status === 'active');
  const nearest = open.find((g) => g.daysLeft !== null && g.daysLeft !== undefined);

  const actions = [
    {
      title: open.length
        ? `Move "${open[0].title}" forward by one step`
        : 'Write down one goal you want to hit this term',
      why: open.length
        ? 'It is your oldest open goal and nothing on it has moved recently.'
        : 'Everything else in this brief gets sharper once there is a goal to aim at.',
      module: 'none',
      minutes: 25,
    },
    {
      title: activity.documents
        ? 'Re-open a document you uploaded and generate a quiz from it'
        : 'Upload one set of notes to the Study Hub',
      why: 'Reading again is slower than being tested; the quiz finds the gaps for you.',
      module: 'study',
      minutes: 30,
    },
    {
      title: activity.interviewsGraded
        ? 'Redo your weakest interview answer and re-grade it'
        : 'Run one mock interview and let it grade you',
      why: 'A graded answer tells you something a re-read never will.',
      module: 'career',
      minutes: 40,
    },
  ];

  return {
    headline: 'A short, honest plan for today.',
    focus: open.length
      ? `Finish one step of "${open[0].title}" before anything else.`
      : 'Set a goal — you are working without one.',
    actions,
    careerAdvice:
      'Evidence beats intent. One finished, visible thing is worth more than three half-built ones.',
    watchOut: nearest
      ? `"${nearest.title}" is due in ${nearest.daysLeft} days and sits at ${nearest.progress}%.`
      : 'Nothing is overdue, which is either good news or a sign nothing has a date on it.',
    encouragement: `You have ${activity.documents ?? 0} documents and ${activity.goals ?? 0} goals on the go. ${MOCK_NOTICE}`,
  };
}

async function generateStudyPlan({ topic, weeks = 4, hoursPerWeek = 6 }) {
  await sleep(160);
  const perWeek = Math.max(1, Math.round(hoursPerWeek / 3));

  return {
    title: `Study plan: ${topic}`,
    summary: `A mock ${weeks}-week plan for "${topic}" at about ${hoursPerWeek} hours a week. ${MOCK_NOTICE}`,
    weeks: Array.from({ length: weeks }, (_, i) => ({
      focus:
        i === 0
          ? 'Find out what you actually do not know.'
          : i === weeks - 1
            ? 'Prove it under something like real conditions.'
            : `Close the gaps found in week ${i}.`,
      tasks: Array.from({ length: 2 }, (_, t) => ({
        title:
          t === 0
            ? `Work through the core material for week ${i + 1} and log every question you got wrong`
            : `Rebuild one worked example from week ${i + 1} without looking at the solution`,
        detail:
          'Keep the log in one place — it becomes the revision list for the last week of the plan.',
        hours: perWeek,
      })),
      checkpoint: `Explain the week ${i + 1} material out loud in five minutes with nothing in front of you.`,
    })),
    ifBehind:
      'Drop the rebuild task before the core material, and never drop the final week — that is the one that tells you where you stand.',
  };
}

// --- Resource Library -------------------------------------------------------

async function recommendResources({ resources, goal }) {
  await sleep(120);
  // Ranked by the community score, so the offline ordering is deterministic and
  // at least defensible rather than arbitrary.
  const ranked = [...resources].sort((a, b) => b.score - a.score).slice(0, 4);

  return {
    picks: ranked.map((r, i) => ({
      resourceId: r.id,
      relevance: 92 - i * 8,
      why: `${r.subject || r.title} lines up with what you have been working through.`,
      howToUse:
        r.type === 'paper'
          ? 'Sit one paper under exam conditions before you look at any answers.'
          : 'Work the first section, then close it and write down what you remember.',
    })),
    noteToStudent: goal
      ? `A mock shortlist for "${goal}" over ${resources.length} resources. ${MOCK_NOTICE}`
      : `A mock shortlist over ${resources.length} resources. ${MOCK_NOTICE}`,
  };
}

// --- Project Marketplace ----------------------------------------------------

async function generateProjectIdeas({ brief, count = 4 }) {
  await sleep(140);

  // Fixed shapes cycled to `count`, so the offline path exercises every field
  // the UI renders rather than repeating one idea four times.
  const shapes = [
    {
      title: 'Attendance ledger for lab sessions',
      tagline: 'Scan in, and the register writes itself.',
      problem:
        'Lab demonstrators lose the first ten minutes of every session calling a register by hand.',
      description:
        'A phone-scannable code per session writes attendance straight to a sheet the department already reads, with a manual override for the student whose phone died.',
      tech: ['React', 'Node.js', 'MongoDB'],
      rolesNeeded: ['Frontend developer'],
      firstMilestone: 'One session, one code, one correct register at the end of it.',
      difficulty: 'beginner',
      weeks: 3,
    },
    {
      title: 'Past-paper question bank',
      tagline: 'Every question your department has ever set, searchable by topic.',
      problem:
        'Past papers circulate as photographs in group chats, so nobody can find every question on one topic.',
      description:
        'Papers are uploaded once, split into individual questions, and tagged by topic so revision can start from a topic rather than a year.',
      tech: ['Python', 'FastAPI', 'PostgreSQL'],
      rolesNeeded: ['Backend developer', 'Someone to tag the first hundred questions'],
      firstMilestone: 'One subject, three years of papers, search that returns the right questions.',
      difficulty: 'intermediate',
      weeks: 6,
    },
    {
      title: 'Campus lost and found',
      tagline: 'Post what you lost; get pinged when it turns up.',
      problem:
        'Lost property sits in a security office nobody thinks to visit until the item is gone.',
      description:
        'Two short forms — lost and found — matched on description and location, with a notification when a new entry looks like your missing thing.',
      tech: ['React Native', 'Node.js', 'MongoDB'],
      rolesNeeded: [],
      firstMilestone: 'Post an item, list what is posted, mark one as returned.',
      difficulty: 'beginner',
      weeks: 2,
    },
    {
      title: 'Timetable clash finder',
      tagline: 'Paste two timetables, see the hour you are both free.',
      problem:
        'Arranging a group project meeting takes more messages than the meeting itself takes minutes.',
      description:
        'Everyone pastes their timetable once; the app intersects them and shows the windows where the whole group is free.',
      tech: ['TypeScript', 'React', 'SQLite'],
      rolesNeeded: ['Designer'],
      firstMilestone: 'Two timetables in, the overlapping hours out.',
      difficulty: 'intermediate',
      weeks: 4,
    },
  ];

  return {
    ideas: Array.from({ length: count }, (_, i) => shapes[i % shapes.length]),
    noteToStudent: brief
      ? `A mock set of ideas around "${brief}". ${MOCK_NOTICE}`
      : `A mock set of project ideas. ${MOCK_NOTICE}`,
  };
}

module.exports = {
  name: 'mock',
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
