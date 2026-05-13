import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuthStore } from '@/stores/auth.store'

const LoginPage = lazy(() => import('@/routes/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/routes/auth/RegisterPage'))
const ProjectListPage = lazy(() => import('@/routes/projects/ProjectListPage'))
const RequirementListPage = lazy(() => import('@/routes/projects/requirements/RequirementListPage'))
const RequirementDetailPage = lazy(() => import('@/routes/projects/requirements/RequirementDetailPage'))
const DashboardPage = lazy(() => import('@/routes/projects/dashboard/DashboardPage'))
const FeatureListPage = lazy(() => import('@/routes/projects/features/FeatureListPage'))
const FeatureDetailPage = lazy(() => import('@/routes/projects/features/FeatureDetailPage'))
const TaskListPage = lazy(() => import('@/routes/projects/tasks/TaskListPage'))
const TaskDetailPage = lazy(() => import('@/routes/projects/tasks/TaskDetailPage'))
const TestListPage = lazy(() => import('@/routes/projects/tests/TestListPage'))
const TestDetailPage = lazy(() => import('@/routes/projects/tests/TestDetailPage'))
const DefectListPage = lazy(() => import('@/routes/projects/defects/DefectListPage'))
const DefectDetailPage = lazy(() => import('@/routes/projects/defects/DefectDetailPage'))
const RTMPage = lazy(() => import('@/routes/projects/traceability/RTMPage'))
const DesignPage = lazy(() => import('@/routes/projects/design/DesignPage'))
const ChangeRequestPage = lazy(() => import('@/routes/projects/change-requests/ChangeRequestPage'))
const UseCasePage = lazy(() => import('./routes/projects/use-cases/UseCasePage'))
const UserStoryPage = lazy(() => import('./routes/projects/user-stories/UserStoryPage'))
const ProjectSettingsPage = lazy(() => import('./routes/projects/settings/SettingsPage'))
const TestExecutionPage = lazy(() => import('./routes/projects/test-execution/TestExecutionPage'))
const TestPhaseDetailPage = lazy(() => import('./routes/projects/test-execution/TestPhaseDetailPage'))
const TestRoundDetailPage = lazy(() => import('./routes/projects/test-execution/TestRoundDetailPage'))
const AdminPage = lazy(() => import('@/routes/admin/AdminPage'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  return token ? <Navigate to="/projects" replace /> : <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/projects" element={<PrivateRoute><ProjectListPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/requirements" element={<PrivateRoute><RequirementListPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/requirements/:reqId" element={<PrivateRoute><RequirementDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/features" element={<PrivateRoute><FeatureListPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/features/:featureId" element={<PrivateRoute><FeatureDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/tasks" element={<PrivateRoute><TaskListPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<PrivateRoute><TaskDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/tests" element={<PrivateRoute><TestListPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/tests/:scenarioId" element={<PrivateRoute><TestDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/test-execution" element={<PrivateRoute><TestExecutionPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/test-execution/:phaseId" element={<PrivateRoute><TestPhaseDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/test-execution/:phaseId/:roundId" element={<PrivateRoute><TestRoundDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/defects" element={<PrivateRoute><DefectListPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/defects/:defectId" element={<PrivateRoute><DefectDetailPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/traceability" element={<PrivateRoute><RTMPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/design" element={<PrivateRoute><DesignPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/use-cases" element={<PrivateRoute><UseCasePage /></PrivateRoute>} />
          <Route path="/projects/:projectId/user-stories" element={<PrivateRoute><UserStoryPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/change-requests" element={<PrivateRoute><ChangeRequestPage /></PrivateRoute>} />
          <Route path="/projects/:projectId/settings" element={<PrivateRoute><ProjectSettingsPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/projects" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
