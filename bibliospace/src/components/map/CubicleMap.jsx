import CubicleShape from './CubicleShape'
import { estadoCubiculo } from '../../utils/time'

// Elementos fijos de cada piso, para orientarse como en la sala real.
// Todo va en una cuadrícula CSS (no hay posiciones absolutas): nada se solapa
// y el plano se reacomoda solo en laptop y en celular.
const ABAJO = {
  1: [
    { tipo: 'mostrador', etiqueta: 'Atención' },
    { tipo: 'entrada', etiqueta: 'Entrada' },
    { tipo: 'escalera', etiqueta: 'Escalera' },
  ],
  2: [
    { tipo: 'escalera', etiqueta: 'Escalera' },
    { tipo: 'pasillo', etiqueta: 'Pasillo' },
    { tipo: 'estanteria', etiqueta: 'Estanterías' },
  ],
}

export default function CubicleMap({ cubiculos, reservas, piso, fecha, hora, seleccionado, favorito, esAdmin, onSelect }) {
  const delPiso = cubiculos
    .filter((c) => Number(c.Piso) === piso)
    .sort((a, b) => Number(a.ID_Cubiculo) - Number(b.ID_Cubiculo))

  if (delPiso.length === 0) return <p className="map-message">No hay cubículos en este piso.</p>

  return (
    <div className="floor-plan" role="group" aria-label={`Plano del piso ${piso}`}>
      <div className="floor-ref floor-ref-ventanal floor-top" aria-hidden="true"><span>Ventanales</span></div>
      <div className="floor-ref floor-ref-estanteria floor-left" aria-hidden="true"><span>Estanterías</span></div>
      <div className="floor-rooms">
        {delPiso.map((cub) => {
          const { estado, reserva } = estadoCubiculo(cub, reservas, fecha, hora)
          const sel =
            seleccionado && Number(seleccionado.Piso) === piso && seleccionado.ID_Cubiculo === cub.ID_Cubiculo
          return (
            <CubicleShape
              key={`${cub.Piso}-${cub.ID_Cubiculo}`}
              cub={cub}
              estado={estado}
              seleccionado={sel}
              esFavorito={favorito === `${cub.Piso}-${cub.ID_Cubiculo}`}
              onSelect={onSelect}
              reservadoPor={esAdmin && reserva ? reserva.Correo_Estudiante : ''}
            />
          )
        })}
      </div>
      <div className="floor-ref floor-ref-estanteria floor-right" aria-hidden="true"><span>Estanterías</span></div>
      <div className="floor-bottom" aria-hidden="true">
        {(ABAJO[piso] ?? ABAJO[1]).map((r) => (
          <div key={r.tipo} className={`floor-ref floor-ref-${r.tipo}`}><span>{r.etiqueta}</span></div>
        ))}
      </div>
    </div>
  )
}
