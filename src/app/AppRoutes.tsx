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
import { QuestionsPage } from '../features/questions/pages/QuestionsPage'
import { OrganiserRoomPage } from '../features/rooms/pages/OrganiserRoomPage'
import { RoomEntryPage } from '../features/rooms/pages/RoomEntryPage'
import { GuestRoomPage } from '../features/rooms/pages/GuestRoomPage'

// Data-router mode enables the editor's supported navigation blocker.
const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<AppLayout />}>
    <Route index element={<HomePage />} />
    <Route path="join" element={<JoinPage />} />
    <Route path="join/:code" element={<RoomEntryPage />} />
    <Route path="rooms/:id" element={<GuestRoomPage />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="signup" element={<SignupPage />} />
    <Route element={<RequireSession />}>
      <Route path="organiser" element={<OrganiserPage />} />
      <Route path="organiser/competitions/new" element={<CreateCompetitionPage />} />
      <Route path="organiser/competitions/:id/edit" element={<EditCompetitionPage />} />
      <Route path="organiser/competitions/:id/questions" element={<QuestionsPage />} />
      <Route path="organiser/rooms/:id" element={<OrganiserRoomPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Route>
))

export function AppRoutes() {
  return <RouterProvider router={router} />
}
