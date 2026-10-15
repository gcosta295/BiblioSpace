import CubicleShape from './CubicleShape'
import { estadoCubiculo } from '../../utils/time'

export default function CubicleMap({ cubiculos, reservas, piso, fecha, hora, seleccionado, esAdmin, onSelect }) {
  const delPiso = cubiculos.filter((c) => Number(c.Piso) === piso)
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 sm:gap-4">
      {delPiso.map((c) => {
        const { estado, reserva } = estadoCubiculo(c, reservas, fecha, hora)
        const sel = seleccionado && Number(seleccionado.Piso) === piso && seleccionado.ID_Cubiculo === c.ID_Cubiculo
        return <CubicleShape key={`${c.Piso}-${c.ID_Cubiculo}`} cub={c} estado={estado} seleccionado={sel} onSelect={onSelect} reservadoPor={esAdmin && reserva ? reserva.Correo_Estudiante : ''} />
      })}
    </div>
  )
}
