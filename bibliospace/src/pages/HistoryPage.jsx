import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../hooks/useLibrary'
import { estadoVisible, miembrosDe } from '../utils/time'

const ESTILO = {
  Activa: 'bg-emerald-100 text-emerald-800',
  Cancelada: 'bg-red-100 text-red-700',
  Expirada: 'bg-slate-200 text-slate-600',
  Finalizada: 'bg-slate-200 text-slate-600',
}

export default function HistoryPage() {
  const { correo, horasRecompensas, recompensasCargando, recompensasError } = useAuth()
  const { reservas, cargando, error } = useLibrary()

  if (!correo) return <p className="text-slate-600">Inicia sesión para ver tu historial.</p>
  if (cargando && !reservas.length) return <p className="text-slate-500">Cargando…</p>
  if (error) return <p className="text-red-600">No se pudo cargar la información.</p>

  const propias = reservas
    .filter((r) => String(r.Correo_Estudiante).toLowerCase() === correo || miembrosDe(r).includes(correo))
    .sort((a, b) => String(b.Fecha_Creacion).localeCompare(String(a.Fecha_Creacion)))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Historial de reservas</h1>
      {propias.length === 0 ? (
        <p className="text-slate-600">
          Aún no tienes reservas. <Link to="/" className="text-indigo-600 underline">Ver el mapa</Link>
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {propias.map((r) => {
            const estado = estadoVisible(r)
            const titular = String(r.Correo_Estudiante).toLowerCase() === correo
            return (
              <li key={r.ID_Reserva} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">
                    Cubículo {r.ID_Cubiculo} · Piso {r.Piso}
                  </p>
                  <p className="text-sm text-slate-600">
                    {r.Fecha} · {r.Franja_Horaria} · {titular ? 'Titular' : 'Invitado'}
                  </p>
                  {r.Fecha_Cancelacion && <p className="text-xs text-slate-500">Cancelada el {String(r.Fecha_Cancelacion).slice(0, 16)}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${ESTILO[estado] || 'bg-slate-100'}`}>{estado}</span>
              </li>
            )
          })}
        </ul>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historial de horas y recompensas</h2>
        {recompensasError ? (
          <p role="alert" className="text-sm text-red-600">No se pudo cargar el historial de recompensas.</p>
        ) : recompensasCargando ? (
          <p className="text-sm text-slate-500">Cargando movimientos…</p>
        ) : horasRecompensas.historial.length ? (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {horasRecompensas.historial.map((evento, index) => (
              <li key={`${evento.tipo}-${evento.id_reserva}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{evento.tipo === 'ganada' ? 'Horas ganadas' : 'Recompensa canjeada'} · {evento.detalle}</p>
                  <p className="text-sm text-slate-600">{evento.fecha}</p>
                  {evento.bono_favorito > 0 && <p className="text-xs text-slate-500">Incluye bono de {evento.bono_favorito} horas por cubículo favorito.</p>}
                </div>
                <strong className={evento.horas < 0 ? 'text-red-700' : 'text-emerald-700'}>
                  {evento.horas > 0 ? '+' : ''}{(Number(evento.horas) + Number(evento.bono_favorito || 0)).toFixed(2)} horas
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">Aún no tienes horas ganadas ni canjes.</p>
        )}
      </section>
    </div>
  )
}
