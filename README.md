# YouthVerse AI

An AI-powered platform for students — study, career, community, and opportunities in one place.
Built from the SRS in `YouthVerse AI Software Requirements Specification.pdf`.

**All 12 SRS modules are built:** Authentication, User Profile, AI Study Hub, Career Hub,
Community Forum, Mentorship, Opportunities Hub, Project Marketplace, Resource Library,
AI Mentor, Wellbeing, Notifications.

---

## Stack

| Layer | Choice | Note |
|---|---|---|
| Backend | Node + Express 5 + Mongoose 9 (CommonJS) | SRS specified FastAPI/PostgreSQL; changed to match the existing toolchain |
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 | per SRS |
| Database | MongoDB | SRS specified PostgreSQL + Redis; no Redis in this phase |
| AI | Anthropic Claude (`claude-opus-5`) | SRS specified OpenAI + LangChain + FAISS |
| Auth | JWT (7d) + bcrypt (cost 12) | per SRS |

### Why there's no vector database

The SRS calls for RAG over FAISS/Chroma. This build instead sends the PDF to Claude
directly via the Files API and enables citations, because:

- Anthropic has no embeddings endpoint, and local `mongod` (community edition) has no
  vector search — a vector store would mean adding both an embedding provider and Atlas.
- Claude reads PDFs natively and returns **page-level citations**, which is the provenance
  a vector store would have been built to provide.
- Prompt caching makes follow-up questions cheap: the document sits at the front of the
  cached prefix, so question 2 onward reads it at roughly a tenth of input price.

Limits accepted: 32 MB / 600 pages per document, one document per chat session. Querying
across many documents at once is where a vector store would start to earn its cost.

The Career Hub takes the opposite route: its inputs are text the user already gave us
(profile, resume, job description), so nothing is uploaded and nothing is cached — those
calls go straight to `messages.parse()` with a Zod schema.

---

## Running it locally

Prerequisites: Node 20+, and MongoDB running locally.

```bash
# 1. Database (skip if mongod is already running)
mongod --dbpath ~/data/db
mongosh --eval 'db.runCommand({ping:1})'     # expect { ok: 1 }

# 2. Backend
cd server
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste into JWT_SECRET
npm install
npm run dev                                   # http://localhost:5050

# 3. Frontend (separate terminal)
cd client
npm install
npm run dev                                   # http://localhost:5173
```

> **Port 5050, not 5000.** On macOS the AirPlay Receiver occupies port 5000 and answers
> every request with a bare `403`, which looks exactly like an auth bug. Either keep 5050
> or turn off AirPlay Receiver in System Settings → General → AirDrop & Handoff.

### Enabling real AI

Everything runs out of the box with `AI_PROVIDER=mock`, which returns canned responses and
needs no key or network — the whole UI is usable offline. For real answers:

```bash
# server/.env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Restart the server. Nothing else changes: `server/src/ai/index.js` picks the provider, and
both implement the same interface.

---

## Layout

```
server/
  src/
    ai/            provider abstraction — index.js picks mock | anthropic
                   prompts.js holds frozen system prompts (cache-stable)
                   schemas.js holds Zod schemas for structured output
    models/        User, Profile, Document, ChatSession, StudyArtifact,
                   Resume, CareerArtifact, InterviewSession, Application,
                   CareerChatSession, MentorProfile, MentorshipSession,
                   MentorshipChat, MentorReview, Opportunity, SavedOpportunity,
                   Community, Thread, Comment, Project, ProjectReview,
                   CollaborationRequest, Resource, SavedResource,
                   Goal, DailyBrief, StudyPlan, MoodEntry, Habit, HabitLog,
                   FocusSession, ChallengeEnrollment, Notification,
                   NotificationPreference
    services/      notify.js — the one place notifications are written
    middlewares/   auth (authenticate + optionalAuth), role, validate, upload, error
                   error.js also discards orphaned uploads on any failed request
    utils/         dayKey (calendar-day helpers), wellbeingContent (curated
                   tips + challenges), ApiError, asyncHandler, normalizeTags
    controllers/   auth, user, study, career, mentorship, opportunity, forum,
                   project, resource, mentor, wellbeing, notification
    routes/        auth, user, study, career, mentorship, opportunity, forum,
                   project, resource, mentor, wellbeing, notification
  uploads/         resource files, served only through GET /resources/:id/download
client/
  src/
    auth/          AuthContext, useAuth, ProtectedRoute
    lib/           api.ts (axios + interceptors), sse.ts (streaming reader)
    components/    ui.tsx primitives, layout/AppShell
    pages/         Login, Register, Dashboard, ProfilePage,
                   study/*, career/*, mentorship/*, opportunities/*, forum/*,
                   projects/*, resources/*, mentor/*, wellbeing/*,
                   notifications/*
```

### Career Hub notes

- **Generated reports are persisted.** ATS checks, skill-gap analyses, roadmaps, and
  company briefs are all `CareerArtifact` rows, so reopening a page shows the last result
  instead of charging for a regeneration. Each keeps its `input` (the job description, the
  target role) so a report stays interpretable months later.
- **Roadmap milestones are keyed by position** — `"<phaseIndex>.<milestoneIndex>"`, assigned
  server-side. Ids that come back from a model aren't stable enough to store progress
  against, so position is the contract between client and server, and the server rejects a
  key that doesn't address a real milestone.
- **An interview locks once graded.** `status` is derived from whether `feedback` exists
  rather than stored separately, so the two can't disagree.

### Mentorship notes

- **Session status is a table, not a pile of ifs.** `TRANSITIONS` in
  `models/MentorshipSession.js` states which move is legal from which state *and who may
  make it*, so "a mentee cannot mark their own session complete" is visible in one place.
  `declined`, `cancelled`, and `completed` are terminal.
- **A slot must clear two checks**: it has to fall inside one of the mentor's weekly
  availability windows, and it must not overlap a session that is still `requested` or
  `confirmed`. Declining or cancelling frees the slot again.
- **Ratings are recomputed, never incremented.** Every review write re-aggregates from
  `MentorReview`, so a failed write can't leave the cached average permanently wrong.
- **A review is anchored to a session**, with a unique index on it — one meeting, one
  rating, and every rating traces back to a session that actually happened.
- **Chat threads are keyed by the sorted id pair.** A unique index on that key is what
  prevents duplicate threads; an index on the participants array would not, since `[a,b]`
  and `[b,a]` are different arrays.
- Times are stored as local `"HH:MM"` strings. That is fine for one campus and is the
  thing to revisit before this crosses time zones.

### Opportunities Hub notes

- **Closed listings are hidden, not deleted.** The default query drops anything past its
  deadline; `?includeExpired=true` brings them back and a direct link always works. A
  posting with no deadline never expires.
- **Listings without a deadline sort last, not first.** Mongo sorts `null` before any date,
  which would put "no rush" at the top of a list ordered by urgency, so the two groups are
  concatenated after the query.
- **`reward` is a string on purpose.** A stipend, a scholarship award, and a prize pool are
  not the same quantity; forcing them into one number would mean inventing a currency and a
  period the source posting never stated.
- **Bookmarks are their own collection.** An array of user ids on the posting would grow
  unbounded inside a document every reader has to load.
- **Tracking hands off to the Career Hub.** `POST /opportunities/:id/track` creates an
  `Application` row in the placement tracker, so an internship found here doesn't get
  re-typed there. The two records are matched on the apply link — the one field they
  genuinely share — which is also what makes tracking idempotent.
- Anyone signed in can post; authors manage their own listings and moderators manage any,
  the same rule the forum uses.

### Notifications notes

- **Writing a notification can never fail the thing that caused it.** `services/notify.js`
  catches everything and callers use `void notify(...)`. Accepting a teammate must not
  return an error because the telling-someone part fell over. The cost is that
  notifications are eventually consistent — they are written just after the response, not
  before it.
- **You are never notified about your own action.** `notify()` drops anything where the
  actor is the recipient. Being told you replied to your own thread is the single most
  reliable way to make someone mute a notifications feature entirely.
- **There is no scheduler, so time-based alerts are computed on read.** Deadlines, upcoming
  sessions, goals coming due, new internships, and new discussions are all derived at
  `POST /notifications/sync`, which the page calls when you open it. The honest cost: an
  alert appears the next time you visit rather than the moment it becomes true. Pretending
  otherwise would mean a cron that does not exist.
- **Every derived alert carries a stable `dedupeKey`,** so syncing ten times a day still
  tells you about a given deadline once. A partial unique index enforces it, and the
  upsert makes a repeat a no-op rather than an error.
- **Goal reminders are keyed on state as well as identity** (`goal:<id>:due` vs
  `:overdue`), so "due soon" and "past its date" are each said once instead of the second
  being swallowed by the first.
- **Derived alerts carry no actor, so the self-notification rule can't protect them.** The
  opportunity query excludes your own postings explicitly — otherwise posting an internship
  would alert you to it.
- **Preferences store what is muted, not what is enabled.** A category added later is
  therefore on by default for everyone who has never opened the settings panel; the
  opposite silently hides new notification types from every existing user.
- **Each type declares its category in one map,** so muting is data-driven and adding a
  type never means remembering to update a switch elsewhere. All 16 declared types are
  emitted somewhere — there is no dead configuration.

### Wellbeing notes

- **This is the most private data in the app, and it is treated that way.** Mood entries
  are never populated into anyone else's response, never aggregated across users, and have
  no public projection. There is no staff view, no leaderboard, and no ranking.
- **The free-text note is never sent to the AI provider.** The check-in is built from the
  numbers and the fixed factor list only. A diary line written for nobody should not have
  to be assumed to be shipped off for analysis, and the numbers are enough to see a pattern.
- **The "talk to someone" signal is plain code, not a model output.** Four low days in the
  last fortnight, or three in a row, raises a quiet note. A safety signal must not depend on
  an API key being set, a provider being reachable, or a model's judgement on the day — and
  it has to behave identically under `AI_PROVIDER=mock`, which is how most of this gets run.
- **`SUPPORT_CONTACT` is configuration, not a constant.** The right service is
  institution-specific; a hardcoded number that is wrong for the reader is worse than none.
  Unset, both the UI and the prompt refer to kinds of people and never invent a service.
- **Nothing is gated on mood.** The signal only ever shows a note. No feature is withheld,
  unlocked, or escalated, and nobody is told.
- **Habit streaks skip days the habit doesn't apply to.** A weekday habit isn't broken by a
  Saturday. Today is a grace day — an unticked today doesn't break a streak, because the day
  isn't over.
- **`longest` is derived from the logs that exist, not a stored high-water mark.** Delete the
  run that set it and it shrinks, because otherwise it would be claiming a streak the data no
  longer supports.
- **A habit completion is a row; a miss is the absence of one.** Un-ticking deletes rather
  than storing a false flag that every streak calculation would have to remember to ignore.
- **The Pomodoro timer runs in the browser and only posts what it finished.** A server-driven
  timer stops being accurate the moment a tab sleeps. The client ticks off a target timestamp
  rather than decrementing a counter, so a backgrounded timer is still right when you return
  to it, and "focus minutes" counts work that happened rather than timers that were started.
- **Challenges don't reset on a missed day.** Days accumulate until the total is reached — a
  challenge that punishes one slip is one most people abandon on day two.
- **Tips and challenges are curated constants, not generated.** This is the one part of the
  app where bad advice does real harm, so it should be reviewable in a diff — and it means
  the module still works with no API key and no network.
- **Mood colour is a sequential single hue, not red-to-green.** It varies in lightness rather
  than hue, so it survives colour blindness by construction (validated: strictly monotonic
  OKLab lightness across the five steps). Red-for-a-bad-day would also paint a low mood as an
  error state, which is the one thing this module should not do. Every mark carries its number
  as well, so colour never carries the value alone.

### AI Mentor notes

- **`/api/mentor` is the AI one; `/api/mentorship` is the human one.** Two different
  modules in the SRS, one letter apart in the URL, so both are spelled out wherever they
  appear rather than abbreviated.
- **Analytics are counted, not generated.** Every number on that dashboard comes from a
  real row — documents, graded interview scores, applications by stage, projects, resource
  downloads, forum posts, completed mentorship sessions. The model is handed those counts
  as facts and told not to inflate them.
- **Quiz scores are deliberately absent.** The app generates quizzes but never records an
  attempt, so there is no honest score to show; the dashboard counts decks generated and
  says so on the page. Reporting a number here would mean inventing one.
- **An unscored metric is `null`, not `0`.** "Never graded an interview" and "scored zero"
  are different claims, and a zero would quietly make the first look like the second.
- **Goal progress has exactly one source.** Steps win when a goal has any; the slider is
  only consulted when it has none. Storing both and showing whichever was written last
  would let a goal read 80% with four of five boxes unticked.
- **One brief per person per day, enforced by a unique index.** Regenerating on every page
  load would burn tokens and hand the student a different plan on every refresh, which is
  the opposite of what a daily plan is for. "Rewrite" replaces the row rather than adding
  a second one, and clears the ticks that referred to the old actions.
- **Plan tasks are keyed by position** — `"<weekIndex>.<taskIndex>"`, assigned server-side
  and validated against the plan, the same contract the Career Hub roadmap uses.
- **A study plan is not a career roadmap.** The roadmap answers "how do I become a backend
  engineer" over months; a plan answers "what do I do each week for the thing in front of
  me". Different horizon, different shape, so it is its own collection rather than another
  `CareerArtifact` kind.
- **Deleting a goal keeps its plans.** The weeks of work are still valid once the goal they
  were aimed at is gone, so the link is cleared rather than the plan destroyed.

### Resource Library notes

- **A resource is a link or a file, and must be one of them.** A row with neither is a title
  nobody can open, so it is rejected rather than stored.
- **The stored filename is generated, never taken from the upload.** The original name is
  kept as a display label only. Nothing that arrived from a client is ever joined onto a
  filesystem path, so an upload called `../../../../tmp/pwned.pdf` lands in `uploads/` under
  a UUID like every other file, and comes back out as a bare `pwned.pdf` attachment.
- **Failed requests discard their upload.** Multer writes to disk before the validators run,
  so a rejected title or an unknown category would otherwise strand a file with nothing
  referencing it — repeat that and you fill the disk. `middlewares/error.middleware.js`
  unlinks `req.file` on every error response, which covers the validator, the controller's
  own guards, and any route added later.
- **Downloads require a token; browsing does not.** The library is public, but the files in
  it are student work, and an unauthenticated download endpoint is one crawler away from
  being a public file host. Everything is sent as an attachment with `nosniff`, so nothing
  renders inline in the browser.
- **The file is fixed once uploaded.** Editing changes metadata only. Swapping the bytes
  under an id that people have already downloaded and cited would be a different resource
  wearing the same name — that is a new upload.
- **The row is deleted before the file.** An orphaned file is recoverable; a row pointing at
  a file that no longer exists is a broken download for everyone who finds it.
- **Sorting by score happens after the query.** The score is derived from the upvote and
  downvote arrays rather than stored, so Mongo has nothing to sort on.
- **Votes are stored as voter ids, not a counter** — the same shape the forum uses, so
  nobody can vote twice and each viewer can be told how they voted.

### Project Marketplace notes

- **Feedback and ratings are one row, not two.** A `ProjectReview` carries both the stars
  and the comment. Split across two collections, a project could accumulate ten ratings and
  two unrelated comments with no way to tell which reviewer meant what.
- **One review per person per project, enforced by a unique index.** Changing your mind is
  an update to that row — a second row would double-count in the average.
- **Ratings are recomputed, never incremented.** Every review write re-aggregates from
  `ProjectReview`, so a failed write can't leave the cached average permanently wrong.
- **"Best rated" sorts by review count first.** A project with a single five-star review is
  not better evidenced than one with twenty averaging 4.2, and an unrated project is unknown
  rather than bad — so unrated ones sort last instead of first.
- **Collaboration requests use a transition table.** `TRANSITIONS` in
  `models/CollaborationRequest.js` states which move is legal from which state *and who may
  make it*, so "only the owner accepts, only the requester withdraws" lives in one place.
  `accepted`, `declined`, and `withdrawn` are terminal.
- **Accepting is what builds the team.** The status change and the `$addToSet` onto
  `collaborators` happen together; there is no separate "add teammate" call to forget.
- **The open-request index is partial, not plain.** Unique on `(project, requester)` only
  where `status: 'pending'`, so two simultaneous open asks are impossible but a declined
  request doesn't bar someone from asking again a term later with more to show.
- **`tech` and `tags` are separate fields.** "React" and "climate" are not the same kind of
  filter, and browsing by one while ignoring the other is the common case.
- **Collaborators are an array on the project, unlike bookmarks in the Opportunities Hub.**
  A student team is small and bounded; an audience is not.
- **Generated ideas are not persisted.** Unlike Career Hub artifacts, the AI Project
  Generator is a shortlist you act on immediately — "Post this" carries the idea into the
  create form via router state, and what gets kept is the project you actually posted.

## API

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/register`, `/api/auth/login` | public |
| `GET` | `/api/auth/me` | required |
| `GET`/`PUT` | `/api/users/me/profile` | required |
| `GET` | `/api/users/:id` | public |
| `POST`/`GET` | `/api/study/documents` | required |
| `GET`/`DELETE` | `/api/study/documents/:id` | owner |
| `GET`/`POST` | `/api/study/documents/:id/chat` | owner — POST streams SSE |
| `POST` | `/api/study/documents/:id/{quiz,flashcards,notes}` | owner |
| `GET` | `/api/study/documents/:id/artifacts` | owner |
| `POST` | `/api/study/explain` | required |
| `GET` | `/api/career/overview` | required |
| `GET`/`PUT` | `/api/career/resume` | required |
| `POST` | `/api/career/resume/ats` | required |
| `POST` | `/api/career/{skill-gap,roadmap,company-prep}` | required |
| `GET`/`DELETE` | `/api/career/artifacts`, `/api/career/artifacts/:id` | owner |
| `PATCH` | `/api/career/artifacts/:id/milestones` | owner — roadmaps only |
| `GET`/`POST` | `/api/career/interviews` | required |
| `GET`/`DELETE` | `/api/career/interviews/:id` | owner |
| `PUT`/`POST` | `/api/career/interviews/:id/{answers,feedback}` | owner |
| `GET`/`POST` | `/api/career/applications` | required |
| `PATCH`/`DELETE` | `/api/career/applications/:id` | owner |
| `GET`/`POST`/`DELETE` | `/api/career/guidance` | required — POST streams SSE |
| `GET` | `/api/mentorship/mentors`, `/api/mentorship/mentors/:id` | public |
| `GET`/`PUT` | `/api/mentorship/me/mentor-profile` | mentor / admin |
| `POST` | `/api/mentorship/match` | required |
| `GET`/`POST` | `/api/mentorship/sessions` | required |
| `GET`/`PATCH` | `/api/mentorship/sessions/:id` | participants only |
| `POST` | `/api/mentorship/sessions/:id/review` | mentee, after completion |
| `GET` | `/api/mentorship/chats`, `/api/mentorship/chats/:userId` | required |
| `POST` | `/api/mentorship/chats/:userId` | required |
| `GET` | `/api/opportunities`, `/api/opportunities/meta`, `/api/opportunities/:id` | public |
| `POST` | `/api/opportunities` | required |
| `PATCH`/`DELETE` | `/api/opportunities/:id` | author or moderator |
| `POST`/`DELETE` | `/api/opportunities/:id/save` | required |
| `GET` | `/api/opportunities/me/saved` | required |
| `POST` | `/api/opportunities/:id/track` | required — creates a placement-tracker row |
| `POST` | `/api/opportunities/recommend` | required |
| `GET` | `/api/notifications` | required — `?unread=true`, `?category=` |
| `GET` | `/api/notifications/unread-count` | required — powers the header badge |
| `POST` | `/api/notifications/sync` | required — derives time-based alerts |
| `PATCH` | `/api/notifications/:id/read` | recipient |
| `POST` | `/api/notifications/read-all` | required |
| `DELETE` | `/api/notifications/read`, `/api/notifications/:id` | recipient |
| `GET`/`PUT` | `/api/notifications/preferences` | required — mute by category |
| `GET` | `/api/wellbeing/overview` | required — private to the caller |
| `GET`/`POST` | `/api/wellbeing/mood` | required |
| `DELETE` | `/api/wellbeing/mood/:day` | required |
| `GET`/`POST` | `/api/wellbeing/habits` | required |
| `PATCH`/`DELETE` | `/api/wellbeing/habits/:id` | owner |
| `POST` | `/api/wellbeing/habits/:id/log` | owner — `done:false` un-ticks |
| `GET`/`POST` | `/api/wellbeing/focus` | required — only finished blocks |
| `GET` | `/api/wellbeing/tips` | required |
| `GET` | `/api/wellbeing/challenges` | required |
| `POST` | `/api/wellbeing/challenges/:key/{join,checkin,leave}` | required |
| `POST` | `/api/wellbeing/checkin` | required — numbers only, never the note |
| `GET` | `/api/mentor/overview`, `/api/mentor/analytics` | required |
| `GET`/`POST` | `/api/mentor/goals` | required |
| `PATCH`/`DELETE` | `/api/mentor/goals/:id` | owner |
| `GET`/`POST` | `/api/mentor/brief` | required — POST reuses today's unless `regenerate` |
| `PATCH` | `/api/mentor/brief/actions` | required — tick an action off today's brief |
| `GET`/`POST` | `/api/mentor/plans` | required |
| `GET`/`DELETE` | `/api/mentor/plans/:id` | owner |
| `PATCH` | `/api/mentor/plans/:id/items` | owner — keyed `"<week>.<task>"` |
| `GET` | `/api/resources`, `/api/resources/meta`, `/api/resources/:id` | public |
| `POST` | `/api/resources` | required — JSON (link) or multipart (file) |
| `PATCH`/`DELETE` | `/api/resources/:id` | uploader or moderator |
| `GET` | `/api/resources/:id/download` | required — attachment, counts a download |
| `POST` | `/api/resources/:id/vote` | required — value 1 / 0 / -1 |
| `POST`/`DELETE` | `/api/resources/:id/save` | required |
| `GET` | `/api/resources/me`, `/api/resources/me/saved` | required |
| `POST` | `/api/resources/recommend` | required |
| `GET` | `/api/projects`, `/api/projects/meta`, `/api/projects/:id` | public |
| `POST` | `/api/projects` | required |
| `PATCH`/`DELETE` | `/api/projects/:id` | author or moderator |
| `GET` | `/api/projects/me`, `/api/projects/me/requests` | required |
| `POST` | `/api/projects/ideas` | required — AI Project Generator |
| `GET`/`POST` | `/api/projects/:id/reviews` | read public, write required |
| `DELETE` | `/api/projects/reviews/:reviewId` | reviewer or moderator |
| `POST` | `/api/projects/:id/requests` | required — not the owner |
| `GET` | `/api/projects/:id/requests` | project owner |
| `PATCH` | `/api/projects/requests/:requestId` | owner or requester, per TRANSITIONS |
| `DELETE` | `/api/projects/:id/collaborators/:userId` | owner, or the collaborator leaving |
| `GET`/`POST` | `/api/forum/communities` | read public, write required |
| `GET`/`POST` | `/api/forum/communities/:slug/threads` | read public, write required |
| `GET`/`DELETE` | `/api/forum/threads/:id` | read public, delete author-or-mod |
| `POST` | `/api/forum/threads/:id/{vote,comments,best-answer,summary}` | required |
| `POST` | `/api/forum/threads/:id/lock` | moderator / admin |
| `POST`/`DELETE` | `/api/forum/comments/:id/vote`, `/api/forum/comments/:id` | required |
| `GET` | `/api/forum/search?q=` | public |

Roles are `student | mentor | moderator | admin`. Only `student` and `mentor` are
self-assignable at registration; promote others directly:

```bash
mongosh youthverse --eval 'db.users.updateOne({email:"x@y.z"},{$set:{role:"moderator"}})'
```

---

## Known gaps

- **Notifications are in-app only.** There is still no email, no push, and no realtime
  transport — the badge polls once a minute and on navigation. A student who never opens
  the app is never told anything.
- **Time-based alerts are computed when you open the page, not by a scheduler.** There is
  no cron in this project, so a deadline reminder appears the next time you visit rather
  than the moment it becomes true. Deduplication is what makes that safe to re-run.
- **`SUPPORT_CONTACT` is blank by default and should be filled in before this runs
  anywhere real.** With it unset the Wellbeing module refers to *kinds* of people rather
  than naming a service — deliberately, because a helpline that is wrong for the reader is
  worse than none. The app never invents one.
- Wellbeing is self-reported and self-read. Nothing in it is clinical, nothing is shared
  with staff or other students, and no part of the app changes behaviour based on a low
  mood beyond showing the support note.
- Learning analytics has a real hole: the app generates quizzes but never records an
  attempt, so there are no quiz *scores* to report and the dashboard counts decks generated
  instead. Interview scores are real, because those are graded and stored.
- The daily brief is keyed to the server's own calendar day. One campus, one timezone —
  the same caveat the mentorship availability windows carry.
- Uploaded resources are stored on the server's own disk under `server/uploads/`. That is
  fine for one machine and wrong for two — there is no object store, no CDN, and no
  replication, so a second instance would not see the first one's files.
- Nothing scans an upload for malware, and nothing verifies the uploader had the right to
  share it. The extension allowlist keeps the obviously executable out; it is not a
  substitute for either check.
- Opportunity listings are typed in by hand. There is no scraping, no partner feed, and no
  verification that a posting is real — moderators are the only filter.
- Projects have no screenshots or cover images, and nothing checks that a repository link
  resolves or that the author wrote the code behind it.
- A collaboration request raises an in-app notification but no email, so an owner who never
  opens the app still never learns someone asked.
- Mentorship has no video calling — the SRS lists it as a later version. A mentor can paste
  their own meeting link onto a confirmed session, and the field is there for it.
- Chat has no realtime transport. A message now raises a notification, but the thread itself
  still only updates on send and on load, not by push.
- Company preparation briefs come from the model's general knowledge, not from any live
  source. Every brief carries a caveat saying so; treat it as a study guide, not intel.
- Resumes have no export. There is a print-style preview tab, but no PDF or DOCX download.
- No email verification, password reset, or social/OAuth login.
- `react-router` carries one open advisory (RSC-mode CSRF, fixed only in the 8.x major).
  This app is a plain `BrowserRouter` SPA with no RSC or server actions, so the affected
  code path is never reached.
- Chat history grows unbounded per session — no compaction yet.
- GitHub/LinkedIn are stored as URLs; there is no OAuth integration behind them.
