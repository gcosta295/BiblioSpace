import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

// "Mantener sesión iniciada": con la casilla marcada la sesión vive en localStorage (permanente);
// sin marcar, en sessionStorage (se pierde al cerrar la pestaña). Por defecto es permanente.
const CLAVE_RECORDAR = 'bibliospace_recordar'

const seguro = (fn, respaldo = null) => {
  try {
    return fn()
  } catch {
    return respaldo
  }
}

export const recordarSesion = () => seguro(() => localStorage.getItem(CLAVE_RECORDAR) !== 'no', true)

export const fijarRecordar = (recordar) =>
  seguro(() => localStorage.setItem(CLAVE_RECORDAR, recordar ? 'si' : 'no'))

const almacenSesion = {
  getItem: (clave) => seguro(() => localStorage.getItem(clave) ?? sessionStorage.getItem(clave)),
  setItem: (clave, valor) =>
    seguro(() => {
      const [destino, otro] = recordarSesion() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
      destino.setItem(clave, valor)
      otro.removeItem(clave)
    }),
  removeItem: (clave) =>
    seguro(() => {
      localStorage.removeItem(clave)
      sessionStorage.removeItem(clave)
    }),
}

// Con valores de relleno la app no se cae al arrancar: las consultas simplemente fallan con un error claro.
export const supabase = createClient(url || 'http://localhost', key || 'sin-clave', {
  auth: { storage: almacenSesion, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
