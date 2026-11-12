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

  // Plano a medio levantar (p. ej. un cubículo recién creado que el admin aún no
  // ubica): los que ya tienen posición se quedan en su sitio y los pendientes
  // ocupan los huecos libres del plano por defecto, para que sigan reservables.
  const ubicados = cubiculos.filter(tienePosicion)
  const pendientes = cubiculos.filter((cub) => !tienePosicion(cub))
  const piso = Number(cubiculos[0]?.Piso)
  const libres = huecosLibres(piso, ubicados)

  // Sin ninguna posición guardada (base de datos aún sin el script del plano)
  // se usa el plano por defecto: el mismo que siembra db/11_mapa_cubiculos.sql,
  // que nunca tapa entrada, escalera, atención ni estanterías.
  return {
    real: ubicados.length > 0,
    piezas: [
      ...ubicados.map((cub) => ({ cub, x: num(cub.Pos_X), y: num(cub.Pos_Y) })),
      ...pendientes.map((cub, i) => ({ cub, ...libres[Math.min(i, libres.length - 1)] })),
    ],
  }
}

// Plano por defecto, en orden de número de cubículo. Debe coincidir con las
// posiciones iniciales de db/11_mapa_cubiculos.sql.
const PLANO_POR_DEFECTO = {
  1: [[17, 19], [39, 19], [61, 19], [83, 19], [28, 56], [56, 56]],
  2: [[20, 19], [42, 19], [64, 19], [86, 19], [36, 56], [64, 56]],
}

// Hueco extra por piso (en la fila de abajo, lejos de entrada y escalera) para
// un cubículo recién creado que el admin aún no ubica. Probado a 360, 390, 820,
// 1024, 1280 y 1440 px sin tapar nada.
const HUECOS_EXTRA = {
  1: [[78, 56]],
  2: [[86, 56]],
}

// Distancia mínima (en %) entre centros para considerar libre un hueco.
const SEPARACION = { x: 18, y: 26 }

function huecosLibres(piso, ubicados) {
  const candidatos = [...(PLANO_POR_DEFECTO[piso] ?? PLANO_POR_DEFECTO[1]), ...(HUECOS_EXTRA[piso] ?? HUECOS_EXTRA[1])]
  const ocupados = ubicados.map((cub) => [num(cub.Pos_X), num(cub.Pos_Y)])
  const libres = candidatos.filter(
    ([x, y]) => !ocupados.some(([ox, oy]) => Math.abs(ox - x) < SEPARACION.x && Math.abs(oy - y) < SEPARACION.y),
  )
  return (libres.length ? libres : candidatos).map(([x, y]) => ({ x, y }))
}
