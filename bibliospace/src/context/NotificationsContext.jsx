import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { marcarNotificacionesLeidas, obtenerNotificaciones } from '../api/library'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext(null)

// La campana del encabezado y el apartado de notificaciones leen la misma lista,
// así que se consulta una sola vez y se comparte desde aquí.
export function NotificationsProvider({ children }) {
  const { correo } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [listo, setListo] = useState(false)

  const recargar = useCallback(async () => {
    if (!correo) {
      setNotificaciones([])
      setListo(true)
      return
    }
    setNotificaciones(await obtenerNotificaciones())
    setListo(true)
  }, [correo])

  useEffect(() => {
    setListo(false)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recargar()
  }, [recargar])

  // Al volver a la pestaña se refresca, igual que hace useLibrary con las reservas.
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [recargar])

  // Se guarda en la base que ya las vio y se apaga el contador en pantalla,
  // sin volver a pedir la lista completa.
  const marcarLeidas = useCallback(async () => {
    if (!correo) return
    await marcarNotificacionesLeidas()
    setNotificaciones((previas) => previas.map((n) => (n.No_Leida ? { ...n, No_Leida: false } : n)))
  }, [correo])

  const noLeidas = notificaciones.reduce((total, n) => total + (n.No_Leida ? 1 : 0), 0)

  return (
    <NotificationsContext value={{ notificaciones, noLeidas, listo, recargar, marcarLeidas }}>
      {children}
    </NotificationsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationsContext)
