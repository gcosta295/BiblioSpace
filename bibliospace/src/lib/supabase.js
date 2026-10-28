import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

// Con valores de relleno la app no se cae al arrancar: las consultas simplemente fallan con un error claro.
export const supabase = createClient(url || 'http://localhost', key || 'sin-clave')
