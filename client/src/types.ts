export type Role = 'student' | 'mentor' | 'moderator' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl: string
  createdAt: string
}

export interface Profile {
  id: string
  user: string
  bio: string
  location: string
  educationLevel: 'school' | 'diploma' | 'undergraduate' | 'postgraduate' | 'other' | ''
  institution: string
  fieldOfStudy: string
  graduationYear: number | null
  skills: string[]
  interests: string[]
  goals: string[]
  githubUrl: string
  linkedinUrl: string
  portfolioUrl: string
  updatedAt: string
}

/** Shape of a failed request after `unwrapError` normalises it. */
export interface FieldError {
  field: string
  message: string
}

// --- AI Study Hub ---------------------------------------------------------

export interface StudyDocument {
  id: string
  title: string
  originalName: string
  sizeBytes: number
  pageCount: number | null
  provider: string
  createdAt: string
}

export interface Citation {
  page: number | null
  quote: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  createdAt?: string
}

export interface ChatSession {
  id: string
  document: string
  messages: ChatMessage[]
  updatedAt: string
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  sourcePage: number | null
}

export interface QuizPayload {
  title: string
  questions: QuizQuestion[]
}

export interface Flashcard {
  front: string
  back: string
  sourcePage: number | null
}

export interface FlashcardsPayload {
  cards: Flashcard[]
}

export interface NotesPayload {
  title: string
  summary: string
  sections: { heading: string; points: string[] }[]
  keyTerms: { term: string; definition: string }[]
}

export type ArtifactKind = 'quiz' | 'flashcards' | 'notes'

export interface StudyArtifact {
  id: string
  document: string
  kind: ArtifactKind
  payload: QuizPayload | FlashcardsPayload | NotesPayload
  createdAt: string
}

// --- Career Hub -----------------------------------------------------------

export interface ResumeEducation {
  institution: string
  qualification: string
  startYear: number | null
  endYear: number | null
  grade: string
}

export interface ResumeExperience {
  organisation: string
  title: string
  startDate: string
  endDate: string
  bullets: string[]
}

export interface ResumeProject {
  name: string
  link: string
  tech: string[]
  bullets: string[]
}

export interface Resume {
  id: string
  fullName: string
  headline: string
  email: string
  phone: string
  location: string
  links: string[]
  summary: string
  education: ResumeEducation[]
  experience: ResumeExperience[]
  projects: ResumeProject[]
  skills: string[]
  certifications: string[]
  achievements: string[]
  updatedAt: string
}

export interface AtsPayload {
  score: number
  verdict: string
  matchedKeywords: string[]
  missingKeywords: string[]
  formattingIssues: string[]
  sectionFeedback: { section: string; issue: string; fix: string }[]
  strengths: string[]
  rewrites: { original: string; improved: string }[]
}

export interface SkillGapPayload {
  targetRole: string
  readiness: number
  summary: string
  strengths: string[]
  gaps: {
    skill: string
    importance: 'critical' | 'important' | 'nice-to-have'
    whyItMatters: string
    howToClose: string
  }[]
  nextSteps: string[]
}

export interface RoadmapPayload {
  title: string
  targetRole: string
  summary: string
  phases: {
    name: string
    durationWeeks: number
    focus: string
    milestones: { title: string; detail: string; resource: string }[]
  }[]
}

export interface CompanyPrepPayload {
  company: string
  role: string
  overview: string
  interviewProcess: { stage: string; whatToExpect: string; howToPrepare: string }[]
  focusTopics: string[]
  likelyQuestions: { question: string; whatTheyAreLookingFor: string }[]
  questionsToAsk: string[]
  caveat: string
}

export type CareerArtifactKind = 'ats' | 'skill_gap' | 'roadmap' | 'company_prep'

export interface CareerArtifact<P = unknown> {
  id: string
  kind: CareerArtifactKind
  title: string
  input: Record<string, unknown>
  payload: P
  completedMilestones: string[]
  createdAt: string
  updatedAt: string
}

export interface InterviewQuestion {
  prompt: string
  category: string
  whatGoodLooksLike: string
  answer: string
}

export interface InterviewFeedback {
  overallScore: number
  summary: string
  perQuestion: {
    index: number
    score: number
    strengths: string
    improvements: string
    modelAnswer: string
  }[]
  nextSteps: string[]
}

export interface InterviewSession {
  id: string
  role: string
  level: 'intern' | 'entry' | 'junior' | 'mid'
  focus: string
  questions: InterviewQuestion[]
  answeredCount: number
  feedback: InterviewFeedback | null
  status: 'in_progress' | 'graded'
  completedAt: string | null
  createdAt: string
}

export type ApplicationStage =
  | 'wishlist'
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'rejected'

export interface Application {
  id: string
  company: string
  role: string
  location: string
  link: string
  stage: ApplicationStage
  appliedOn: string | null
  nextStepOn: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CareerOverview {
  resume: {
    exists: boolean
    sections: Record<string, boolean> | null
    completion: number
    updatedAt: string | null
  }
  artifactCounts: Partial<Record<CareerArtifactKind, number>>
  interviews: { total: number; graded: number }
  applications: { total: number; byStage: Record<ApplicationStage, number> }
}

// --- Mentorship -----------------------------------------------------------

export interface UserRef {
  id: string
  name: string
  role: Role
  avatarUrl?: string
}

/** A weekly recurring window. `day` is 0 = Sunday. Times are "HH:MM". */
export interface AvailabilitySlot {
  day: number
  start: string
  end: string
}

export interface MentorProfile {
  id: string
  user: UserRef
  headline: string
  bio: string
  expertise: string[]
  languages: string[]
  yearsExperience: number
  currentRole: string
  organisation: string
  sessionLengthMinutes: 15 | 30 | 45 | 60
  availability: AvailabilitySlot[]
  isPublished: boolean
  acceptingMentees: boolean
  ratingAverage: number
  ratingCount: number
  completedSessions: number
  updatedAt: string
}

export type SessionStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed'

export interface MentorshipSession {
  id: string
  mentor: UserRef
  mentee: UserRef
  topic: string
  agenda: string
  scheduledFor: string
  durationMinutes: number
  endsAt: string
  status: SessionStatus
  statusReason: string
  meetingLink: string
  completedAt: string | null
  createdAt: string
  /** The viewer's side of this specific session. */
  myRole?: 'mentor' | 'mentee'
  reviewed?: boolean
}

export interface MentorReview {
  id: string
  session: string
  mentor: UserRef | string
  mentee: UserRef | string
  rating: number
  comment: string
  createdAt: string
}

export interface ChatMessageItem {
  sender: UserRef | string
  body: string
  mine: boolean
  createdAt: string
}

export interface MentorshipChat {
  id: string
  participants: (UserRef | string)[]
  messages: ChatMessageItem[]
  lastMessageAt: string | null
  unreadCount: number
}

export interface ChatSummary {
  id: string
  withUser: UserRef
  lastMessage: ChatMessageItem | null
  lastMessageAt: string | null
  unreadCount: number
}

export interface MentorMatch {
  mentorId: string
  fit: number
  why: string
  askThemAbout: string
  mentor: MentorProfile
}

export interface MentorshipOverview {
  canMentor: boolean
  isPublishedMentor: boolean
  sessions: { total: number; byStatus: Partial<Record<SessionStatus, number>> }
  nextSessionAt: string | null
  unreadMessages: number
  rating: { average: number; count: number } | null
}

// --- Opportunities Hub ----------------------------------------------------

export type OpportunityType =
  | 'internship'
  | 'scholarship'
  | 'hackathon'
  | 'competition'
  | 'workshop'
  | 'webinar'
  | 'event'

export interface Opportunity {
  id: string
  postedBy: UserRef | string
  type: OpportunityType
  title: string
  organisation: string
  description: string
  location: string
  isRemote: boolean
  link: string
  tags: string[]
  eligibility: string
  reward: string
  deadline: string | null
  startsAt: string | null
  expired: boolean
  daysLeft: number | null
  createdAt: string
  /** Viewer-specific, resolved server-side per request. */
  saved: boolean
  tracked: boolean
  canManage: boolean
}

export interface OpportunityMeta {
  types: OpportunityType[]
  counts: Record<OpportunityType, number>
  tags: string[]
  closingSoon: number
}

export interface OpportunityPick {
  opportunityId: string
  fit: number
  why: string
  watchOut: string
  opportunity: Opportunity
}

// --- Notifications --------------------------------------------------------

export type NotificationCategory =
  | 'discussions'
  | 'opportunities'
  | 'reminders'
  | 'suggestions'
  | 'collaboration'

export interface NotificationActor {
  id: string
  name: string
  avatarUrl?: string
}

export interface AppNotification {
  id: string
  type: string
  category: NotificationCategory
  title: string
  body: string
  /** In-app path, stored server-side so it survives the source changing shape. */
  link: string
  actor: NotificationActor | null
  read: boolean
  readAt: string | null
  createdAt: string
}

export interface NotificationPreferences {
  categories: NotificationCategory[]
  /** Stored as muted rather than enabled, so new categories default to on. */
  muted: NotificationCategory[]
  updatedAt: string
}

// --- Wellbeing ------------------------------------------------------------

export type MoodFactor =
  | 'sleep'
  | 'workload'
  | 'exams'
  | 'health'
  | 'social'
  | 'family'
  | 'money'
  | 'other'

export interface MoodEntry {
  id: string
  day: string
  mood: number
  energy: number | null
  sleepHours: number | null
  factors: MoodFactor[]
  /** Private to the writer. Never sent to the AI provider. */
  note: string
  createdAt: string
  updatedAt: string
}

export interface MoodStats {
  entries: number
  averageMood: number | null
  averageSleep: number | null
  lowDays: number
  bestDay: string | null
}

/**
 * Computed server-side in plain code, not by a model, so it behaves the same
 * with or without an API key. Only ever surfaces a gentle note.
 */
export interface SupportSignal {
  suggested: boolean
  reason: string | null
  /** Institution-configured. Null means refer to kinds of people, not services. */
  contact: string | null
}

export interface HabitDay {
  day: string
  done: boolean
  applies: boolean
}

export interface Habit {
  id: string
  title: string
  detail: string
  /** 0 = Sunday. Days the habit applies to; others are skipped in streaks. */
  daysOfWeek: number[]
  archived: boolean
  createdAt: string
  streak: { current: number; longest: number }
  doneToday: boolean
  appliesToday: boolean
  lastWeek: HabitDay[]
}

export interface FocusSession {
  id: string
  day: string
  minutes: number
  label: string
  kind: 'focus' | 'break'
  endedAt: string
  createdAt: string
}

export interface FocusSummary {
  todayMinutes: number
  todaySessions: number
  weekMinutes: number
  byDay: { day: string; minutes: number; sessions: number }[]
}

export interface Tip {
  key: string
  tag: string
  title: string
  body: string
}

export interface Challenge {
  key: string
  title: string
  days: number
  summary: string
  why: string
  dailyPrompt: string
}

export interface ChallengeEnrollment {
  id: string
  challenge: Challenge | null
  status: 'active' | 'completed' | 'abandoned'
  completedDays: string[]
  daysDone: number
  daysTotal: number
  doneToday: boolean
  startedAt: string
  finishedAt: string | null
}

export interface WellbeingOverview {
  today: string
  mood: MoodEntry | null
  stats: MoodStats
  support: SupportSignal
  habits: Habit[]
  focus: FocusSummary
  challenges: ChallengeEnrollment[]
  tipOfTheDay: Tip
}

export interface WellbeingCheckin {
  observation: string
  pattern: string
  suggestions: { title: string; why: string; effort: 'tiny' | 'small' | 'medium' }[]
  reachOut: string
  note: string
}

// --- AI Mentor ------------------------------------------------------------

export type GoalCategory = 'study' | 'career' | 'project' | 'skill' | 'other'
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped'

export interface GoalStep {
  title: string
  done: boolean
}

export interface Goal {
  id: string
  title: string
  detail: string
  category: GoalCategory
  targetDate: string | null
  daysLeft: number | null
  status: GoalStatus
  steps: GoalStep[]
  manualProgress: number
  /** Derived server-side: from the steps if there are any, else the slider. */
  progress: number
  tracksSteps: boolean
  overdue: boolean
  achievedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BriefAction {
  title: string
  why: string
  module: string
  minutes: number
}

export interface DailyBriefPayload {
  headline: string
  focus: string
  actions: BriefAction[]
  careerAdvice: string
  watchOut: string
  encouragement: string
}

export interface DailyBrief {
  id: string
  day: string
  payload: DailyBriefPayload
  completedActions: number[]
  createdAt: string
  updatedAt: string
}

export interface StudyPlanTask {
  title: string
  detail: string
  hours: number
}

export interface StudyPlanWeek {
  focus: string
  tasks: StudyPlanTask[]
  checkpoint: string
}

export interface StudyPlanPayload {
  title: string
  summary: string
  weeks: StudyPlanWeek[]
  ifBehind: string
}

export interface StudyPlan {
  id: string
  goal: string | null
  title: string
  input: { topic?: string; weeks?: number; hoursPerWeek?: number }
  payload: StudyPlanPayload
  /** Keys are "<weekIndex>.<taskIndex>", assigned server-side. */
  completedItems: string[]
  taskCount: number
  progress: number
  createdAt: string
  updatedAt: string
}

/** Every number here is counted from real rows — nothing is estimated. */
export interface MentorAnalytics {
  study: {
    documents: number
    quizzes: number
    flashcardDecks: number
    noteSets: number
    documentsThisWeek: number
  }
  career: {
    hasResume: boolean
    artifacts: Record<CareerArtifactKind, number>
    roadmapMilestonesDone: number
    interviews: { total: number; graded: number; thisWeek: number }
    /** Null rather than 0 when nothing has been graded. */
    averageInterviewScore: number | null
    bestInterviewScore: number | null
    applications: { total: number; byStage: Record<ApplicationStage, number> }
  }
  community: { threads: number; comments: number; mentorshipSessionsCompleted: number }
  building: {
    projectsOwned: number
    projectsJoined: number
    resourcesShared: number
    resourceDownloads: number
    resourcesSaved: number
  }
  goals: {
    total: number
    active: number
    achieved: number
    overdue: number
    averageProgress: number | null
  }
}

export interface MentorOverview {
  analytics: MentorAnalytics
  goals: Goal[]
  brief: DailyBrief | null
  planCount: number
  today: string
}

// --- Resource Library -----------------------------------------------------

export type ResourceType =
  | 'notes'
  | 'paper'
  | 'template'
  | 'book'
  | 'roadmap'
  | 'interview'
  | 'cheatsheet'

export interface ResourceFile {
  originalName: string
  sizeBytes: number
  mimeType: string
}

export interface Resource {
  id: string
  uploadedBy: UserRef | string
  type: ResourceType
  title: string
  description: string
  subject: string
  tags: string[]
  link: string
  /** Null for link-only resources. The stored name never reaches the client. */
  file: ResourceFile | null
  hasFile: boolean
  score: number
  downloadCount: number
  createdAt: string
  updatedAt: string
  /** Viewer-specific, resolved server-side per request. */
  myVote: number
  saved: boolean
  canManage: boolean
}

export interface ResourceMeta {
  types: ResourceType[]
  counts: Record<ResourceType, number>
  subjects: string[]
  tags: string[]
  withFiles: number
}

export interface ResourcePick {
  resourceId: string
  relevance: number
  why: string
  howToUse: string
  resource: Resource
}

// --- Project Marketplace --------------------------------------------------

export type ProjectStatus = 'idea' | 'building' | 'beta' | 'shipped'

export type CollaborationStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export interface Project {
  id: string
  owner: UserRef | string
  title: string
  tagline: string
  description: string
  status: ProjectStatus
  repoUrl: string
  demoUrl: string
  tech: string[]
  tags: string[]
  lookingForTeammates: boolean
  rolesNeeded: string[]
  collaborators: (UserRef | string)[]
  ratingAverage: number
  ratingCount: number
  createdAt: string
  updatedAt: string
  /** Viewer-specific, resolved server-side per request. */
  canManage: boolean
  isCollaborator: boolean
  myRating: number | null
  myRequestStatus: CollaborationStatus | null
}

export interface ProjectMeta {
  statuses: ProjectStatus[]
  counts: Record<ProjectStatus, number>
  tech: string[]
  tags: string[]
  openTeams: number
}

export interface ProjectReview {
  id: string
  project: string
  reviewer: UserRef | string
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
  canManage: boolean
}

export interface CollaborationRequest {
  id: string
  project: { id: string; title: string; status: ProjectStatus } | string
  requester: UserRef | string
  role: string
  message: string
  status: CollaborationStatus
  statusReason: string
  decidedAt: string | null
  createdAt: string
  /** Which side of this request the viewer is on. */
  mySide: 'owner' | 'requester' | null
}

export interface ProjectIdea {
  title: string
  tagline: string
  problem: string
  description: string
  tech: string[]
  rolesNeeded: string[]
  firstMilestone: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  weeks: number
}

export interface ProjectIdeasPayload {
  ideas: ProjectIdea[]
  noteToStudent: string
}

// --- Community Forum ------------------------------------------------------

export interface Community {
  id: string
  name: string
  slug: string
  description: string
  threadCount?: number
  createdAt: string
}

export interface AuthorRef {
  id: string
  name: string
  role: Role
}

export interface ThreadSummary {
  summary: string
  keyPoints: string[]
  openQuestions: string[]
  generatedAt: string
}

export interface Thread {
  id: string
  community: { id: string; name: string; slug: string } | string
  author: AuthorRef | string
  title: string
  body: string
  tags: string[]
  score: number
  /** The viewer's own vote: 1, -1, or 0. */
  myVote: number
  bestAnswer: string | null
  commentCount: number
  locked: boolean
  summary: ThreadSummary | null
  summaryStale: boolean
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  thread: string
  author: AuthorRef | string
  body: string
  score: number
  myVote: number
  isBestAnswer: boolean
  createdAt: string
}

/** Author is populated on reads but can be a bare id elsewhere. */
export function authorOf(value: AuthorRef | string): AuthorRef | null {
  return typeof value === 'string' ? null : value
}
