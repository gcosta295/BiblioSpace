import { COLORES, ETIQUETAS } from '../../utils/estados'

export default function CubicleShape({ cub, estado, seleccionado, onSelect, reservadoPor }) {
  const clickable = estado === 'disponible'
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onSelect(cub)}
      aria-label={`Cubículo ${cub.ID_Cubiculo}, piso ${cub.Piso}, ${ETIQUETAS[estado]}`}
      className={`flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 p-2 transition ${COLORES[estado]} ${
        clickable ? 'cursor-pointer' : 'cursor-not-allowed'
      } ${seleccionado ? 'ring-4 ring-indigo-400' : ''}`}
    >
      <span className="text-2xl font-bold">{cub.ID_Cubiculo}</span>
      <span className="text-xs">{ETIQUETAS[estado]}</span>
      <span className="text-xs opacity-70">👥 {cub.Capacidad}</span>
      {reservadoPor && <span className="mt-1 max-w-full truncate text-[10px]">Reservado por: {reservadoPor}</span>}
    </button>
  )
}
