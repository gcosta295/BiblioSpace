import { ETIQUETAS } from '../../utils/estados'
import availableIcon from '../../assets/seat-available.png'
import occupiedIcon from '../../assets/seat-occupied.png'
import blockedIcon from '../../assets/seat-blocked.png'

const ICONOS = {
  disponible: availableIcon,
  ocupado: occupiedIcon,
  bloqueado: blockedIcon,
}

export default function CubicleShape({ cub, estado, seleccionado, onSelect, reservadoPor }) {
  const clickable = estado === 'disponible'
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onSelect(cub)}
      aria-label={`Cubículo ${cub.ID_Cubiculo}, piso ${cub.Piso}, ${ETIQUETAS[estado]}`}
      className={`seat-card seat-card-${estado}${seleccionado ? ' is-selected' : ''}`}
    >
      <img className={`seat-icon seat-icon-${estado}`} src={ICONOS[estado]} alt="" aria-hidden="true" />
      <span className="seat-number">Cubículo {cub.ID_Cubiculo}</span>
      <span className="seat-status">{ETIQUETAS[estado]}</span>
      <span className="seat-capacity">{cub.Capacidad} {Number(cub.Capacidad) === 1 ? 'persona' : 'personas'}</span>
      {reservadoPor && <span className="seat-owner">Por: {reservadoPor}</span>}
    </button>
  )
}
