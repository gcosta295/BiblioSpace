export const RANGOS_RECOMPENSAS = [
  { nivel: 1, nombre: 'Semilla Samán', icono: '🌿', desde: 0, hasta: 20, tono: 'semilla', color: '#9ec33e' },
  { nivel: 2, nombre: 'Flor de Samán', icono: '🌸', desde: 20, hasta: 45, tono: 'flor', color: '#e09ec1' },
  { nivel: 3, nombre: 'Tuqueque de la Biblioteca', icono: '🦎', desde: 45, hasta: 75, tono: 'tuqueque', color: '#61a779' },
  { nivel: 4, nombre: 'Águila Unimetana', icono: '🦅', desde: 75, hasta: 100, tono: 'aguila', color: '#c08d78' },
  { nivel: 5, nombre: 'Samán de Oro', icono: '🌳', desde: 100, hasta: null, tono: 'oro', color: '#ffd007' },
]

export const CATALOGO_BASE_RECOMPENSAS = [
  {
    tipo: 'VENTANA_ANTICIPADA',
    nombre: 'Reserva Anticipada / Ventana Extendida',
    descripcion: 'Reserva hasta 48 horas antes en tus siguientes cinco reservas.',
    costo_horas: 20,
    stock: null,
  },
  {
    tipo: 'PASE_EXPRESS',
    nombre: 'Extensión de Tiempo de Reserva (Pase Express)',
    descripcion: 'Agrega una hora a tu reserva mientras está en curso, sujeto a disponibilidad.',
    costo_horas: 15,
    stock: null,
  },
  {
    tipo: 'FAVORITO',
    nombre: 'Selección de Cubículo Específico (Cubículo VIP/Favorito)',
    descripcion: 'Marca un cubículo como favorito. Las sesiones completadas allí otorgan dos horas extra.',
    costo_horas: 30,
    stock: null,
  },
  {
    tipo: 'CANCELACION_TARDIA',
    nombre: 'Renuncia de Penalización por Cancelación Tardía',
    descripcion: 'Cancela una reserva futura sin consumir una de tus tres cancelaciones diarias.',
    costo_horas: 10,
    stock: null,
  },
]

export function rangoPorHoras(horas) {
  return RANGOS_RECOMPENSAS.find((rango) => horas < rango.hasta || rango.hasta === null) ?? RANGOS_RECOMPENSAS.at(-1)
}
