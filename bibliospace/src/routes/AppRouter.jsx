import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/layout/Layout'
import MapPage from '../pages/MapPage'
import MyReservationPage from '../pages/MyReservationPage'
import AdminPage from '../pages/AdminPage'
import HistoryPage from '../pages/HistoryPage'

function AdminRoute({ children }) {
  const { rol, perfilCargando } = useAuth()
  if (perfilCargando) return <p className="admin-access-loading" role="status">Verificando permisos…</p>
  return rol === 'admin' ? children : <Navigate to="/" replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MapPage />} />
        <Route path="/mi-reserva" element={<MyReservationPage />} />
        <Route path="/historial" element={<HistoryPage />} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
