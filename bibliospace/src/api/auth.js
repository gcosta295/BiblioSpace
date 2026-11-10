import { fijarRecordar, supabase } from '../lib/supabase'

// Cuentas con Supabase Auth. La base valida correo, nombre y carnet al registrar (db/08_registro_login.sql).
// Todas devuelven { status: 'ok' | 'error', mensaje? } para que la interfaz no maneje excepciones.

const traducir = (error) => {
  const texto = String(error?.message ?? '').toLowerCase()
  if (error?.code === 'user_already_exists' || texto.includes('already registered')) {
    return 'Este correo ya está registrado. Inicia sesión.'
  }
  if (texto.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión: revisa el mensaje que te enviamos.'
  if (texto.includes('database error saving new user')) {
    return 'Los datos no son válidos. Revisa tu nombre, carnet y correo institucional.'
  }
  if (texto.includes('password')) return 'La contraseña no cumple los requisitos (mínimo 8 caracteres).'
  if (texto.includes('rate limit') || error?.status === 429) return 'Demasiados intentos. Espera unos minutos.'
  if (texto.includes('failed to fetch')) return 'No hay conexión con el servidor.'
  return error?.message || 'Ocurrió un error inesperado.'
}

// true / false, o null si no se pudo consultar
export const correoRegistrado = async (correo) => {
  const { data, error } = await supabase.rpc('correo_registrado', { p_correo: correo })
  return error ? null : data === true
}

// Registra la cuenta y deja la sesión iniciada y permanente. nombre y carnet viajan como metadatos
// que el servidor valida antes de crear la cuenta. Si el proyecto exige confirmar el correo no hay
// sesión todavía: se devuelve { status: 'ok', confirmar: true } para avisarlo en pantalla.
export const registrarUsuario = async ({ nombre, carnet, correo, clave }) => {
  fijarRecordar(true)
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: clave,
    options: { data: { nombre, carnet } },
  })
  if (error) return { status: 'error', mensaje: traducir(error) }
  return { status: 'ok', confirmar: !data.session }
}

export const iniciarSesion = async ({ correo, clave, recordar }) => {
  fijarRecordar(recordar)
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
  if (!error) return { status: 'ok' }
  if (String(error.message).toLowerCase().includes('invalid login')) {
    const registrado = await correoRegistrado(correo)
    return {
      status: 'error',
      mensaje:
        registrado === false
          ? 'Este correo no está registrado. Solicita acceso institucional.'
          : 'Contraseña incorrecta.',
    }
  }
  return { status: 'error', mensaje: traducir(error) }
}

export const cerrarSesion = () => supabase.auth.signOut()

// -> { status: 'ok', correo, nombre, carnet, rol: 'admin' | 'user' }
export const obtenerMiPerfil = async () => {
  const { data, error } = await supabase.rpc('mi_perfil')
  if (error) return { status: 'error', mensaje: error.message }
  return { status: 'ok', ...data }
}
