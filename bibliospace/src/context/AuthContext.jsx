import { createContext, useContext, useEffect, useState } from 'react'
import { obtenerPerfil } from '../api/library'

const DOMINIO = '@correo.unimet.edu.ve'
const KEY = 'bibliospace_correo'
const AuthContext = createContext(null)

const leerCorreo = () => {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

// Sin login: el correo solo identifica al usuario en reservas; el rol lo decide el backend.
export function AuthProvider({ children }) {
  const [correo, setCorreoState] = useState(leerCorreo)
  const [rol, setRol] = useState('user')

  useEffect(() => {
    if (!correo) return
    let activo = true
    obtenerPerfil(correo).then((p) => activo && setRol(p.status === 'ok' ? p.rol : 'user'))
    return () => {
      activo = false
    }
  }, [correo])

  // Devuelve null si ok, o un mensaje de error
  const setCorreo = (valor) => {
    const c = valor.trim().toLowerCase()
    if (c && !c.endsWith(DOMINIO)) return `Usa tu correo institucional (${DOMINIO}).`
    localStorage.setItem(KEY, c)
    setCorreoState(c)
    if (!c) setRol('user')
    return null
  }

  return <AuthContext value={{ correo, rol, setCorreo }}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
