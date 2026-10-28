import { useCallback, useEffect, useState } from 'react'
import { obtenerCubiculos, obtenerReservas } from '../api/library'
import { useAuth } from '../context/AuthContext'

// Carga cubículos y reservas; `recargar` refresca tras cualquier cambio.
export function useLibrary() {
  const { correo } = useAuth()
  const [cubiculos, setCubiculos] = useState([])
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const recargar = useCallback(async () => {
    setCargando(true)
    const [c, r] = await Promise.all([obtenerCubiculos(), obtenerReservas(correo)])
    const ok = Array.isArray(c) && Array.isArray(r) && c.length > 0
    setError(!ok)
    if (ok) {
      setCubiculos(c)
      setReservas(r)
    }
    setCargando(false)
  }, [correo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recargar()
  }, [recargar])

  // Al volver a la pestaña (p. ej. tras confirmar la reserva desde el correo) se refresca solo.
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [recargar])

  return { cubiculos, reservas, cargando, error, recargar }
}
