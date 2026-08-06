import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ProfilePage } from './pages/ProfilePage'
import { StudyHome } from './pages/study/StudyHome'
import { DocumentWorkspace } from './pages/study/DocumentWorkspace'
import { CareerHome } from './pages/career/CareerHome'
import { ResumePage } from './pages/career/ResumePage'
import { GuidancePage } from './pages/career/GuidancePage'
import { InterviewPage } from './pages/career/InterviewPage'
import { SkillGapPage } from './pages/career/SkillGapPage'
import { RoadmapPage } from './pages/career/RoadmapPage'
import { CompanyPrepPage } from './pages/career/CompanyPrepPage'
import { ApplicationsPage } from './pages/career/ApplicationsPage'
import { MentorshipHome } from './pages/mentorship/MentorshipHome'
import { MentorDetail } from './pages/mentorship/MentorDetail'
import { SessionsPage } from './pages/mentorship/SessionsPage'
import { ChatPage } from './pages/mentorship/ChatPage'
import { MentorListingPage } from './pages/mentorship/MentorListingPage'
import { OpportunitiesHome } from './pages/opportunities/OpportunitiesHome'
import { OpportunityDetail } from './pages/opportunities/OpportunityDetail'
import { PostOpportunity } from './pages/opportunities/PostOpportunity'
import { ProjectsHome } from './pages/projects/ProjectsHome'
import { ProjectDetail } from './pages/projects/ProjectDetail'
import { PostProject } from './pages/projects/PostProject'
import { RequestsPage } from './pages/projects/RequestsPage'
import { NotificationsPage } from './pages/notifications/NotificationsPage'
import { WellbeingHome } from './pages/wellbeing/WellbeingHome'
import { MoodPage } from './pages/wellbeing/MoodPage'
import { HabitsPage } from './pages/wellbeing/HabitsPage'
import { FocusPage } from './pages/wellbeing/FocusPage'
import { ChallengesPage } from './pages/wellbeing/ChallengesPage'
import { MentorHome } from './pages/mentor/MentorHome'
import { GoalsPage } from './pages/mentor/GoalsPage'
import { PlansPage } from './pages/mentor/PlansPage'
import { PlanDetail } from './pages/mentor/PlanDetail'
import { ResourcesHome } from './pages/resources/ResourcesHome'
import { ResourceDetail } from './pages/resources/ResourceDetail'
import { PostResource } from './pages/resources/PostResource'
import { ForumHome } from './pages/forum/ForumHome'
import { CommunityThreads } from './pages/forum/CommunityThreads'
import { ThreadDetail } from './pages/forum/ThreadDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="study" element={<StudyHome />} />
              <Route path="study/:documentId" element={<DocumentWorkspace />} />
              <Route path="career" element={<CareerHome />} />
              <Route path="career/resume" element={<ResumePage />} />
              <Route path="career/guidance" element={<GuidancePage />} />
              <Route path="career/interviews" element={<InterviewPage />} />
              <Route path="career/skill-gap" element={<SkillGapPage />} />
              <Route path="career/roadmap" element={<RoadmapPage />} />
              <Route path="career/companies" element={<CompanyPrepPage />} />
              <Route path="career/applications" element={<ApplicationsPage />} />
              <Route path="mentorship" element={<MentorshipHome />} />
              <Route path="mentorship/me" element={<MentorListingPage />} />
              <Route path="mentorship/sessions" element={<SessionsPage />} />
              <Route path="mentorship/chat" element={<ChatPage />} />
              <Route path="mentorship/chat/:userId" element={<ChatPage />} />
              {/* Declared after the fixed paths above so "me" and "chat" win. */}
              <Route path="mentorship/mentors/:mentorId" element={<MentorDetail />} />
              <Route path="opportunities" element={<OpportunitiesHome />} />
              {/* Declared before ":opportunityId" so "new" isn't read as an id. */}
              <Route path="opportunities/new" element={<PostOpportunity />} />
              <Route path="opportunities/:opportunityId" element={<OpportunityDetail />} />
              <Route path="opportunities/:opportunityId/edit" element={<PostOpportunity />} />
              <Route path="projects" element={<ProjectsHome />} />
              {/* Declared before ":projectId" so "new" and "requests" aren't read as ids. */}
              <Route path="projects/new" element={<PostProject />} />
              <Route path="projects/requests" element={<RequestsPage />} />
              <Route path="projects/:projectId" element={<ProjectDetail />} />
              <Route path="projects/:projectId/edit" element={<PostProject />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="wellbeing" element={<WellbeingHome />} />
              <Route path="wellbeing/mood" element={<MoodPage />} />
              <Route path="wellbeing/habits" element={<HabitsPage />} />
              <Route path="wellbeing/focus" element={<FocusPage />} />
              <Route path="wellbeing/challenges" element={<ChallengesPage />} />
              {/* The AI Mentor. "/mentorship" is the human one. */}
              <Route path="mentor" element={<MentorHome />} />
              <Route path="mentor/goals" element={<GoalsPage />} />
              {/* Declared before ":planId" so "plans" isn't read as an id. */}
              <Route path="mentor/plans" element={<PlansPage />} />
              <Route path="mentor/plans/:planId" element={<PlanDetail />} />
              <Route path="resources" element={<ResourcesHome />} />
              {/* Declared before ":resourceId" so "new" isn't read as an id. */}
              <Route path="resources/new" element={<PostResource />} />
              <Route path="resources/:resourceId" element={<ResourceDetail />} />
              <Route path="resources/:resourceId/edit" element={<PostResource />} />
              <Route path="community" element={<ForumHome />} />
              {/* Declared before ":slug" so it isn't swallowed as a slug. */}
              <Route path="community/thread/:threadId" element={<ThreadDetail />} />
              <Route path="community/:slug" element={<CommunityThreads />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
