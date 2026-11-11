import { Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { SignupPage } from '../features/auth/pages/SignupPage'
import { HomePage } from '../features/home/pages/HomePage'
import { JoinPage } from '../features/join/pages/JoinPage'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './pages/NotFoundPage'
import { RequireSession } from '../features/auth/components/RequireSession'
import { OrganiserPage } from '../features/organiser/pages/OrganiserPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route element={<RequireSession />}>
          <Route path="organiser" element={<OrganiserPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
