// Geometría del plano de cada piso.
//
// La posición de cada cubículo vive en los datos (columnas pos_x, pos_y de la
// tabla `cubiculos`), expresada en porcentaje del ancho y alto del piso. Si la
// biblioteca mueve un cubículo se cambia un dato, no el código.
//
// Aquí solo está lo que no cambia con los datos: las referencias físicas que
// permiten orientarse al llegar. Ajustar estos valores después de medir.

// tipo: 'entrada' | 'ventanal' | 'escalera' | 'estanteria' | 'mostrador'
export const REFERENCIAS = {
  1: [
    { tipo: 'ventanal', etiqueta: 'Ventanales', x: 6, y: 0, ancho: 88, alto: 3 },
    { tipo: 'entrada', etiqueta: 'Entrada', x: 1, y: 38, ancho: 4, alto: 24 },
    { tipo: 'escalera', etiqueta: 'Escalera', x: 88, y: 60, ancho: 10, alto: 36 },
    { tipo: 'mostrador', etiqueta: 'Atención', x: 6, y: 88, ancho: 24, alto: 10 },
    { tipo: 'estanteria', etiqueta: 'Estanterías', x: 38, y: 88, ancho: 48, alto: 10 },
  ],
  2: [
    { tipo: 'ventanal', etiqueta: 'Ventanales', x: 6, y: 0, ancho: 88, alto: 3 },
    { tipo: 'escalera', etiqueta: 'Escalera', x: 2, y: 60, ancho: 10, alto: 36 },
    { tipo: 'estanteria', etiqueta: 'Estanterías', x: 14, y: 88, ancho: 34, alto: 10 },
    { tipo: 'estanteria', etiqueta: 'Estanterías', x: 56, y: 88, ancho: 34, alto: 10 },
  ],
}

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v))

/** ¿El cubículo trae su posición en los datos? */
export const tienePosicion = (cub) =>
  Number.isFinite(num(cub.Pos_X)) && Number.isFinite(num(cub.Pos_Y))

/**
 * Posición de cada cubículo del piso, en porcentaje.
 *
 * `real` indica si las coordenadas vienen de los datos. Cuando todavía no
 * existen, se reparten en cuadrícula para que la aplicación siga funcionando
 * mientras se levanta el plano.
 */
export function posicionesDelPiso(cubiculos) {
  const real = cubiculos.length > 0 && cubiculos.every(tienePosicion)

  if (real) {
    return {
      real: true,
      piezas: cubiculos.map((cub) => ({ cub, x: num(cub.Pos_X), y: num(cub.Pos_Y) })),
    }
  }

  const columnas = Math.min(3, Math.max(1, cubiculos.length))
  return {
    real: false,
    piezas: cubiculos.map((cub, i) => ({
      cub,
      x: 12 + (i % columnas) * (76 / Math.max(columnas - 1, 1)),
      y: 18 + Math.floor(i / columnas) * 34,
    })),
  }
}
