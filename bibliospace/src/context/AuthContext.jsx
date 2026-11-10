import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PERFIL_VACIO = { nombre: '', carnet: '', rol: 'user' }

// Sesión real con Supabase Auth. Se conserva la forma que usaban los demás componentes
// (correo, rol, perfilCargando) y se suman nombre, carnet y las acciones de cuenta.
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(undefined) // undefined = todavía comprobando
  const [perfil, setPerfil] = useState(PERFIL_VACIO)
  const [perfilCorreo, setPerfilCorreo] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session ?? null))
    // Aquí solo se actualiza el estado: llamar a Supabase dentro de este callback puede bloquear la sesión.
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const correo = sesion?.user?.email?.toLowerCase() ?? ''

  useEffect(() => {
    if (!correo) return
    let activo = true
    authApi.obtenerMiPerfil().then((p) => {
      if (!activo) return
      setPerfil(p.status === 'ok' ? p : PERFIL_VACIO)
      setPerfilCorreo(correo)
    })
    return () => {
      activo = false
    }
  }, [correo])

  const perfilListo = Boolean(correo) && perfilCorreo === correo
  const datos = perfilListo ? perfil : PERFIL_VACIO

  // Entra y devuelve { status, mensaje?, rol? }. Con comoAdmin solo deja pasar a administradores.
  const iniciarSesion = async ({ correo: c, clave, recordar, comoAdmin = false }) => {
    const res = await authApi.iniciarSesion({ correo: c.trim().toLowerCase(), clave, recordar })
    if (res.status !== 'ok') return res
    const mio = await authApi.obtenerMiPerfil()
    if (mio.status !== 'ok') {
      await authApi.cerrarSesion()
      return { status: 'error', mensaje: 'No se pudo cargar tu perfil. Intenta de nuevo.' }
    }
    if (comoAdmin && mio.rol !== 'admin') {
      await authApi.cerrarSesion()
      return { status: 'error', mensaje: 'Esta cuenta no es de administrador.' }
    }
    return { status: 'ok', rol: mio.rol }
  }

  const registrar = (datosRegistro) =>
    authApi.registrarUsuario({ ...datosRegistro, correo: datosRegistro.correo.trim().toLowerCase() })

  const valor = {
    correo,
    nombre: datos.nombre,
    carnet: datos.carnet,
    rol: datos.rol,
    sesionLista: sesion !== undefined,
    perfilCargando: sesion === undefined || (Boolean(correo) && !perfilListo),
    iniciarSesion,
    registrar,
    cerrarSesion: authApi.cerrarSesion,
  }

  return <AuthContext value={valor}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
