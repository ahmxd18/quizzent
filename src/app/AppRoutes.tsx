import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { SignupPage } from '../features/auth/pages/SignupPage'
import { HomePage } from '../features/home/pages/HomePage'
import { JoinPage } from '../features/join/pages/JoinPage'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './pages/NotFoundPage'
import { RequireSession } from '../features/auth/components/RequireSession'
import { OrganiserPage } from '../features/organiser/pages/OrganiserPage'
import { CreateCompetitionPage } from '../features/competitions/pages/CreateCompetitionPage'
import { EditCompetitionPage } from '../features/competitions/pages/EditCompetitionPage'

// Data-router mode enables the editor's supported navigation blocker.
const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<AppLayout />}>
    <Route index element={<HomePage />} />
    <Route path="join" element={<JoinPage />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="signup" element={<SignupPage />} />
    <Route element={<RequireSession />}>
      <Route path="organiser" element={<OrganiserPage />} />
      <Route path="organiser/competitions/new" element={<CreateCompetitionPage />} />
      <Route path="organiser/competitions/:id/edit" element={<EditCompetitionPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Route>
))

export function AppRoutes() {
  return <RouterProvider router={router} />
}
