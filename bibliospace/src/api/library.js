import { supabase } from '../lib/supabase'

// La base de datos solo se toca mediante funciones (ver db/02_funciones.sql), que aplican las reglas.
// Aquí se traducen sus respuestas a la forma que usa la interfaz.

const ESTADO_RESERVA = {
  ANTICIPADA: 'Activa',
  ACTIVA: 'Activa',
  COMPLETADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
}

const CAPACIDAD = 6 // fija: el schema no tiene columna de capacidad

const aCubiculo = (c) => ({
  ID_Cubiculo: c.numero,
  Piso: c.piso,
  Capacidad: CAPACIDAD,
  Estado: c.estado === 'BLOQUEADO' ? 'Bloqueado' : 'Disponible',
  Motivo_Bloqueo: c.motivo,
  // Posición física dentro del piso, en porcentaje. Llegan vacías mientras
  // `listar_cubiculos` no devuelva las columnas pos_x / pos_y.
  Pos_X: c.pos_x,
  Pos_Y: c.pos_y,
})

const aReserva = (r) => ({
  ID_Reserva: r.id,
  Fecha: r.fecha,
  Franja_Horaria: r.franja,
  ID_Cubiculo: r.numero,
  Piso: r.piso,
  Correo_Estudiante: r.titular,
  Nombre: r.nombre,
  Carnet: r.carnet,
  Miembros: r.miembros.join(','),
  Personas: r.personas,
  Estado: ESTADO_RESERVA[r.estado] ?? r.estado,
  Fecha_Creacion: r.creada_en,
  Fecha_Cancelacion: r.cancelada_en,
})

const idCubiculo = (piso, numero) => `${piso}-${numero}`

// -> { status: 'ok', ...datos } o { status: 'error', mensaje }
const rpc = async (nombre, args) => {
  const { data, error } = await supabase.rpc(nombre, args)
  if (error) return { status: 'error', mensaje: error.message }
  return { status: 'ok', ...(data !== null && typeof data === 'object' && !Array.isArray(data) ? data : { valor: data }) }
}

export const obtenerCubiculos = async () => {
  const { data, error } = await supabase.rpc('listar_cubiculos')
  if (error) {
    console.error('Error al leer cubículos:', error.message)
    return []
  }
  return data.map(aCubiculo)
}

// Con el correo, solo ves los datos personales de tus reservas (el admin ve todas)
export const obtenerReservas = async (correo = '') => {
  const { data, error } = await supabase.rpc('listar_reservas', { p_correo: correo })
  if (error) {
    console.error('Error al leer reservas:', error.message)
    return null
  }
  return data.map(aReserva)
}

// -> { status: 'ok', rol: 'admin' | 'user' }
export const obtenerPerfil = async (correo) => {
  const res = await rpc('perfil', { p_correo: correo })
  return res.status === 'ok' ? { status: 'ok', rol: res.valor } : res
}

// { correo, nombre, carnet, piso, cubiculoId, fecha: 'YYYY-MM-DD', horaInicio: 'HH:00', duracion: 1|2, miembros: [correos] }
export const crearReserva = (d) =>
  rpc('crear_reserva', {
    p_correo: d.correo,
    p_cubiculo: idCubiculo(d.piso, d.cubiculoId),
    p_fecha: d.fecha,
    p_hora: parseInt(d.horaInicio, 10),
    p_duracion: d.duracion,
    p_miembros: d.miembros,
    p_nombre: d.nombre,
    p_carnet: d.carnet,
  })

export const cancelarReserva = (correo, id) => rpc('cancelar_reserva', { p_correo: correo, p_id: id })

export const agregarMiembro = (correo, id, miembro) =>
  rpc('agregar_miembro', { p_correo: correo, p_id: id, p_miembro: miembro })

export const quitarMiembro = (correo, id, miembro) =>
  rpc('quitar_miembro', { p_correo: correo, p_id: id, p_miembro: miembro })

// Solo admin: el número se asigna solo (siguiente libre del piso) -> { status: 'ok', id: número }
export const crearCubiculo = async (correo, piso) => {
  const res = await rpc('crear_cubiculo', { p_correo: correo, p_piso: piso })
  return res.status === 'ok' ? { status: 'ok', id: Number(String(res.valor).split('-')[1]) } : res
}

// Solo admin: bloquear = true | false
export const bloquearCubiculo = (correo, piso, cubiculoId, bloquear, motivo = '') =>
  rpc('bloquear_cubiculo', {
    p_correo: correo,
    p_cubiculo: idCubiculo(piso, cubiculoId),
    p_bloquear: bloquear,
    p_motivo: motivo,
  })

// Solo admin: expulsa a los ocupantes y deja el cubículo disponible. El motivo es obligatorio.
// -> { status: 'ok', cubiculo, id_reserva, ocupantes: [correos], personas }
export const liberarCubiculo = (correo, piso, cubiculoId, motivo) =>
  rpc('liberar_cubiculo', {
    p_correo: correo,
    p_cubiculo: idCubiculo(piso, cubiculoId),
    p_motivo: motivo,
  })

// Solo admin: bloqueos, habilitaciones y liberaciones, de lo más reciente a lo más antiguo.
export const obtenerLogAdmin = async (correo, limite = 20) => {
  const { data, error } = await supabase.rpc('listar_log_admin', { p_correo: correo, p_limite: limite })
  if (error) {
    console.error('Error al leer el log de administración:', error.message)
    return []
  }
  return data.map((l) => ({
    ID_Cubiculo: Number(String(l.id_cubiculo).split('-')[1]),
    Piso: Number(String(l.id_cubiculo).split('-')[0]),
    Accion: l.accion,
    Correo_Admin: l.correo_admin,
    Motivo: l.motivo,
    Ocupantes: l.ocupantes ?? [],
    Fecha: l.marca_tiempo,
  }))
}
