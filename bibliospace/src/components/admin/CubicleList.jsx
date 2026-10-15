import { COLORES, ETIQUETAS } from '../../utils/estados'
import { estadoCubiculo, horaActual, hoyISO } from '../../utils/time'
import BlockToggle from './BlockToggle'

export default function CubicleList({ cubiculos, reservas, correo, onChanged, onError }) {
  const fecha = hoyISO()
  const hora = horaActual()
  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {cubiculos.map((c) => {
        const { estado, reserva } = estadoCubiculo(c, reservas, fecha, hora)
        return (
          <li key={`${c.Piso}-${c.ID_Cubiculo}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                Cubículo {c.ID_Cubiculo} · Piso {c.Piso}
                <span className="ml-2 text-sm font-normal text-slate-500">cap. {c.Capacidad}</span>
              </p>
              <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${COLORES[estado].split(' hover')[0]}`}>
                {ETIQUETAS[estado]}
              </span>
              {reserva && (
                <p className="mt-1 text-sm text-slate-600">
                  Reservado por: {reserva.Correo_Estudiante} ({reserva.Personas} personas) · {reserva.Franja_Horaria}
                </p>
              )}
              {estado === 'bloqueado' && c.Motivo_Bloqueo && <span className="ml-2 text-sm text-slate-500">{c.Motivo_Bloqueo}</span>}
            </div>
            <BlockToggle cub={c} correo={correo} onChanged={onChanged} onError={onError} />
          </li>
        )
      })}
    </ul>
  )
}
