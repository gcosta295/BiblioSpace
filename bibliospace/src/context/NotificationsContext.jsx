import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { marcarNotificacionesLeidas, obtenerNotificaciones } from '../api/library'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext(null)

// La campana del encabezado y el apartado de notificaciones leen la misma lista,
// así que se consulta una sola vez y se comparte desde aquí.
export function NotificationsProvider({ children }) {
  const { correo } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [cargadoPara, setCargadoPara] = useState(null)
  const [marcadas, setMarcadas] = useState(false)

  const recargar = useCallback(async () => {
    const lista = correo ? await obtenerNotificaciones() : []
    setNotificaciones(lista)
    setMarcadas(false)
    setCargadoPara(correo)
  }, [correo])

  useEffect(() => {
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

  // El contador baja de una vez, sin esperar al servidor. La lista no se toca: las
  // notificaciones siguen marcadas como nuevas mientras el usuario las está leyendo,
  // y al recargar la página la base ya responde que están leídas.
  const marcarLeidas = useCallback(async () => {
    if (!correo || marcadas) return
    setMarcadas(true)
    await marcarNotificacionesLeidas()
  }, [correo, marcadas])

  const listo = cargadoPara === correo
  const noLeidas = marcadas ? 0 : notificaciones.reduce((total, n) => total + (n.No_Leida ? 1 : 0), 0)

  return (
    <NotificationsContext value={{ notificaciones, noLeidas, listo, recargar, marcarLeidas }}>
      {children}
    </NotificationsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationsContext)
