import CubicleShape from './CubicleShape'
import { estadoCubiculo } from '../../utils/time'
import { posicionesDelPiso, REFERENCIAS } from '../../utils/plano'

// El plano conserva las tarjetas de cubículo tal cual (clases seat-card): lo
// único que cambia frente a la cuadrícula es DÓNDE se coloca cada una, usando
// la posición física que viene en los datos.
export default function CubicleMap({ cubiculos, reservas, piso, fecha, hora, seleccionado, esAdmin, onSelect }) {
  const delPiso = cubiculos
    .filter((c) => Number(c.Piso) === piso)
    .sort((a, b) => Number(a.ID_Cubiculo) - Number(b.ID_Cubiculo))

  const { piezas } = posicionesDelPiso(delPiso)
  const referencias = REFERENCIAS[piso] ?? []

  const tarjetas = piezas.map(({ cub, x, y }) => {
    const { estado, reserva } = estadoCubiculo(cub, reservas, fecha, hora)
    const sel =
      seleccionado && Number(seleccionado.Piso) === piso && seleccionado.ID_Cubiculo === cub.ID_Cubiculo
    return (
      <div
        key={`${cub.Piso}-${cub.ID_Cubiculo}`}
        className="floor-slot"
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        <CubicleShape
          cub={cub}
          estado={estado}
          seleccionado={sel}
          onSelect={onSelect}
          reservadoPor={esAdmin && reserva ? reserva.Correo_Estudiante : ''}
        />
      </div>
    )
  })

  return (
    <figure className="floor-figure">
      <div className="floor-plan" role="group" aria-label={`Plano del piso ${piso}`}>
        {referencias.map((r, i) => (
          <div
            key={`${r.tipo}-${i}`}
            className={`floor-ref floor-ref-${r.tipo}`}
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.ancho}%`, height: `${r.alto}%` }}
            aria-hidden="true"
          >
            <span>{r.etiqueta}</span>
          </div>
        ))}
        {tarjetas}
      </div>
    </figure>
  )
}
