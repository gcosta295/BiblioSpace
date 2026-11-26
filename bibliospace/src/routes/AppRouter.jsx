import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/layout/Layout'
import MapPage from '../pages/MapPage'
import MyReservationPage from '../pages/MyReservationPage'
import AdminPage from '../pages/AdminPage'
import HistoryPage from '../pages/HistoryPage'
import LoginPage from '../pages/LoginPage'
import PerfilPage from '../pages/PerfilPage'
import RegisterPage from '../pages/RegisterPage'
import RecompensasPage from '../pages/RecompensasPage'
import NotificationsPage from '../pages/NotificationsPage'

// Páginas que necesitan cuenta: sin sesión se manda al login y, al entrar, se vuelve a la página pedida.
function RutaProtegida() {
  const { correo, sesionLista } = useAuth()
  const location = useLocation()
  if (!sesionLista) return <p className="admin-access-loading" role="status">Comprobando sesión…</p>
  if (!correo) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

function AdminRoute({ children }) {
  const { rol, perfilCargando } = useAuth()
  if (perfilCargando) return <p className="admin-access-loading" role="status">Verificando permisos…</p>
  return rol === 'admin' ? children : <Navigate to="/" replace />
}

function StudentRoute({ children }) {
  const { rol, perfilCargando } = useAuth()
  if (perfilCargando) return <p className="admin-access-loading" role="status">Verificando permisos…</p>
  return rol === 'admin' ? <Navigate to="/admin" replace /> : children
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route element={<RutaProtegida />}>
          <Route path="/mi-reserva" element={<StudentRoute><MyReservationPage /></StudentRoute>} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/historial" element={<StudentRoute><HistoryPage /></StudentRoute>} />
          <Route path="/notificaciones" element={<StudentRoute><NotificationsPage /></StudentRoute>} />
          <Route path="/recompensas" element={<StudentRoute><RecompensasPage /></StudentRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
