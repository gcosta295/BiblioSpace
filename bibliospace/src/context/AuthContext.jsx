import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import { obtenerRecompensas } from '../api/library'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PERFIL_VACIO = { nombre: '', carnet: '', rol: 'user' }
const RECOMPENSAS_VACIAS = {
  acumuladas: 0,
  estaSemana: 0,
  saldo: 0,
  gastadas: 0,
  reservasCompletadasEstaSemana: 0,
  favorito: '',
  reservaCancelacionProtegida: '',
  ventana48Restantes: 0,
  catalogo: [],
  semanas: [],
  historial: [],
}

const normalizarRecompensas = (res) => {
  const semanas = Array.isArray(res.semanas) ? res.semanas : []
  return {
    acumuladas: Number(res.horas_acumuladas) || 0,
    estaSemana: Number(semanas.at(-1)?.horas) || 0,
    saldo: Number(res.saldo) || 0,
    gastadas: Number(res.horas_gastadas) || 0,
    reservasCompletadasEstaSemana: Number(res.reservas_completadas_esta_semana) || 0,
    favorito: res.cubiculo_favorito || '',
    reservaCancelacionProtegida: res.reserva_cancelacion_protegida || '',
    ventana48Restantes: Number(res.ventana_48_restantes) || 0,
    catalogo: Array.isArray(res.catalogo) ? res.catalogo : [],
    semanas,
    historial: Array.isArray(res.historial) ? res.historial : [],
  }
}

// Sesión real con Supabase Auth. Se conserva la forma que usaban los demás componentes
// (correo, rol, perfilCargando) y se suman nombre, carnet y las acciones de cuenta.
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(undefined) // undefined = todavía comprobando
  const [perfil, setPerfil] = useState(PERFIL_VACIO)
  const [perfilCorreo, setPerfilCorreo] = useState('')
  const [recompensas, setRecompensas] = useState(RECOMPENSAS_VACIAS)
  const [correoRecompensas, setCorreoRecompensas] = useState('')
  const [recompensasErrorCorreo, setRecompensasErrorCorreo] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session ?? null))
    // Aquí solo se actualiza el estado: llamar a Supabase dentro de este callback puede bloquear la sesión.
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const correo = sesion?.user?.email?.toLowerCase() ?? ''
  const perfilListo = Boolean(correo) && perfilCorreo === correo
  const datos = perfilListo ? perfil : PERFIL_VACIO
  const perfilCargando = sesion === undefined || (Boolean(correo) && !perfilListo)

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

  useEffect(() => {
    if (!correo || !perfilListo) return
    if (datos.rol === 'admin') return
    let activo = true
    obtenerRecompensas(correo)
      .then((res) => {
        if (!activo) return
        if (res.status !== 'ok') {
          setRecompensasErrorCorreo(correo)
          setCorreoRecompensas(correo)
          return
        }
        setRecompensas(normalizarRecompensas(res))
        setRecompensasErrorCorreo('')
        setCorreoRecompensas(correo)
      })
      .catch((error) => {
        console.error('Error al consultar las recompensas:', error)
        if (activo) {
          setRecompensasErrorCorreo(correo)
          setCorreoRecompensas(correo)
        }
      })

    return () => {
      activo = false
    }
  }, [correo, perfilListo, datos.rol])

  const recompensasListas = Boolean(correo) && (datos.rol === 'admin' || correoRecompensas === correo)
  const refrescarRecompensas = async () => {
    if (!correo || datos.rol === 'admin') return { status: 'ok' }
    const res = await obtenerRecompensas(correo)
    if (res.status !== 'ok') {
      setRecompensasErrorCorreo(correo)
      setCorreoRecompensas(correo)
      return res
    }
    setRecompensas(normalizarRecompensas(res))
    setRecompensasErrorCorreo('')
    setCorreoRecompensas(correo)
    return res
  }

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
    perfilCargando,
    horasRecompensas: datos.rol === 'admin' ? RECOMPENSAS_VACIAS : recompensasListas ? recompensas : RECOMPENSAS_VACIAS,
    recompensasCargando: Boolean(correo) && !recompensasListas && (perfilCargando || datos.rol !== 'admin'),
    recompensasError: datos.rol !== 'admin' && recompensasListas && recompensasErrorCorreo === correo,
    refrescarRecompensas,
    iniciarSesion,
    registrar,
    cerrarSesion: authApi.cerrarSesion,
  }

  return <AuthContext value={valor}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
