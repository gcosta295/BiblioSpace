// Estados que ocupan el cubículo y a las personas (Pendiente = esperando confirmación por correo)
export const OCUPA = ['Activa', 'Pendiente']

const pad = (n) => String(n).padStart(2, '0')

export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const horaActual = () => new Date().getHours()

export const horaTexto = (h) => `${pad(h)}:00`

export const aHoras = (franja) => String(franja).split('-').map((t) => parseInt(t, 10))

// Estado de un cubículo para la fecha y hora (hora completa) seleccionadas.
// -> { estado: 'bloqueado' | 'ocupado' | 'disponible', reserva? }
export function estadoCubiculo(cub, reservas, fecha, hora) {
  if (cub.Estado === 'Bloqueado') return { estado: 'bloqueado' }
  const reserva = reservas.find((r) => {
    if (!OCUPA.includes(r.Estado) || r.Fecha !== fecha) return false
    if (Number(r.Piso) !== Number(cub.Piso) || Number(r.ID_Cubiculo) !== Number(cub.ID_Cubiculo)) return false
    const [ini, fin] = aHoras(r.Franja_Horaria)
    return hora >= ini && hora < fin
  })
  return reserva ? { estado: 'ocupado', reserva } : { estado: 'disponible' }
}

export const inicioMs = (r) => new Date(`${r.Fecha}T${String(r.Franja_Horaria).split('-')[0]}:00`).getTime()

// Estado para mostrar: una reserva activa cuya franja ya terminó se muestra como Finalizada
export const estadoVisible = (r) => (r.Estado === 'Activa' && finTexto(r) <= ahoraTexto() ? 'Finalizada' : r.Estado)

export const finTexto = (r) => `${r.Fecha} ${String(r.Franja_Horaria).split('-')[1]}`

export const ahoraTexto = () => {
  const d = new Date()
  return `${hoyISO()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const miembrosDe = (r) =>
  String(r.Miembros || '').split(',').map((m) => m.trim().toLowerCase()).filter(Boolean)

// Reserva activa que aún no termina en la que participa el usuario (titular o miembro)
export const reservaVigente = (reservas, correo) =>
  reservas.find(
    (r) =>
      OCUPA.includes(r.Estado) &&
      finTexto(r) > ahoraTexto() &&
      (String(r.Correo_Estudiante).toLowerCase() === correo || miembrosDe(r).includes(correo)),
  )

// Correos conocidos (titulares y miembros de reservas anteriores) para sugerir invitados
export const conocidos = (reservas) => [
  ...new Set(reservas.flatMap((r) => [String(r.Correo_Estudiante).toLowerCase(), ...miembrosDe(r)]).filter(Boolean)),
]
