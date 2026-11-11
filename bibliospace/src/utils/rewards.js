import { aHoras, estadoVisible, miembrosDe } from './time.js'

export const RANGOS_RECOMPENSAS = [
  { nivel: 1, nombre: 'Semilla', icono: '🌿', desde: 0, hasta: 20, tono: 'semilla' },
  { nivel: 2, nombre: 'Flor de Samán', icono: '🌸', desde: 20, hasta: 45, tono: 'flor' },
  { nivel: 3, nombre: 'Tuqueque', icono: '🦎', desde: 45, hasta: 75, tono: 'tuqueque' },
  { nivel: 4, nombre: 'Águila', icono: '🦅', desde: 75, hasta: 100, tono: 'aguila' },
  { nivel: 5, nombre: 'Samán de Oro', icono: '🌳', desde: 100, hasta: null, tono: 'oro' },
]

export function rangoPorHoras(horas) {
  return RANGOS_RECOMPENSAS.find((rango) => horas < rango.hasta || rango.hasta === null) ?? RANGOS_RECOMPENSAS.at(-1)
}

function horasDeReserva(reserva) {
  const [inicio, fin] = aHoras(reserva.Franja_Horaria)
  return Number.isFinite(inicio) && Number.isFinite(fin) ? Math.max(0, fin - inicio) : 0
}

function esParticipante(reserva, correo) {
  return (
    String(reserva.Correo_Estudiante).toLowerCase() === correo ||
    miembrosDe(reserva).includes(correo)
  )
}

function inicioDeSemana(fecha) {
  const inicio = new Date(fecha)
  inicio.setHours(0, 0, 0, 0)
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7))
  return inicio
}

export function calcularHorasRecompensas(reservas, correo) {
  if (!correo) return { acumuladas: 0, estaSemana: 0 }

  const semana = inicioDeSemana(new Date())
  const acumuladas = reservas.reduce((total, reserva) => {
    if (estadoVisible(reserva) !== 'Finalizada' || !esParticipante(reserva, correo)) return total
    return total + horasDeReserva(reserva)
  }, 0)

  const estaSemana = reservas.reduce((total, reserva) => {
    if (estadoVisible(reserva) !== 'Finalizada' || !esParticipante(reserva, correo)) return total
    const fechaReserva = new Date(`${reserva.Fecha}T00:00:00`)
    return fechaReserva >= semana ? total + horasDeReserva(reserva) : total
  }, 0)

  return { acumuladas, estaSemana }
}

export function nombreDesdeCorreo(correo, alternativa = 'Invitado') {
  return correo
    ? correo
        .split('@')[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(' ')
    : alternativa
}
