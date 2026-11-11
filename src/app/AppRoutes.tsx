import { Route, Routes } from 'react-router'
import { AccountPage } from '../features/auth/pages/AccountPage'
import { HomePage } from '../features/home/pages/HomePage'
import { JoinPage } from '../features/join/pages/JoinPage'
import { AppLayout } from './layout/AppLayout'
import { NotFoundPage } from './pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="login" element={<AccountPage mode="login" />} />
        <Route path="signup" element={<AccountPage mode="signup" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
