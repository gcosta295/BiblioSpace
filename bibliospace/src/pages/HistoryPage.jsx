import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../hooks/useLibrary'
import { estadoVisible, miembrosDe } from '../utils/time'

const ESTILO = {
  Activa: 'history-badge-activa',
  Cancelada: 'history-badge-cancelada',
  Expirada: 'history-badge-neutra',
  Finalizada: 'history-badge-neutra',
}

export default function HistoryPage() {
  const { correo, horasRecompensas, recompensasCargando, recompensasError } = useAuth()
  const { reservas, cargando, error } = useLibrary()

  if (!correo) return <p className="history-muted">Inicia sesión para ver tu historial.</p>
  if (cargando && !reservas.length) return <p className="history-muted">Cargando…</p>
  if (error) return <p className="history-error">No se pudo cargar la información.</p>

  const propias = reservas
    .filter((r) => String(r.Correo_Estudiante).toLowerCase() === correo || miembrosDe(r).includes(correo))
    .sort((a, b) => String(b.Fecha_Creacion).localeCompare(String(a.Fecha_Creacion)))

  return (
    <div className="history-page space-y-4">
      <h1 className="history-title text-xl font-semibold">Historial de reservas</h1>
      {propias.length === 0 ? (
        <p className="history-muted">
          Aún no tienes reservas. <Link to="/" className="history-link underline">Ver el mapa</Link>
        </p>
      ) : (
        <ul className="history-list">
          {propias.map((r) => {
            const estado = estadoVisible(r)
            const titular = String(r.Correo_Estudiante).toLowerCase() === correo
            return (
              <li key={r.ID_Reserva} className="history-item flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">
                    Cubículo {r.ID_Cubiculo} · Piso {r.Piso}
                  </p>
                  <p className="history-muted text-sm">
                    {r.Fecha} · {r.Franja_Horaria} · {titular ? 'Titular' : 'Invitado'}
                  </p>
                  {r.Fecha_Cancelacion && <p className="history-subtle text-xs">Cancelada el {String(r.Fecha_Cancelacion).slice(0, 16)}</p>}
                </div>
                <span className={`history-badge rounded-full px-3 py-1 text-xs font-medium ${ESTILO[estado] || 'history-badge-neutra'}`}>{estado}</span>
              </li>
            )
          })}
        </ul>
      )}
      <section className="space-y-3">
        <h2 className="history-subtitle text-lg font-semibold">Historial de horas y recompensas</h2>
        {recompensasError ? (
          <p role="alert" className="history-error text-sm">No se pudo cargar el historial de recompensas.</p>
        ) : recompensasCargando ? (
          <p className="history-muted text-sm">Cargando movimientos…</p>
        ) : horasRecompensas.historial.length ? (
          <ul className="history-list">
            {horasRecompensas.historial.map((evento, index) => (
              <li key={`${evento.tipo}-${evento.id_reserva}-${index}`} className="history-item flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{evento.tipo === 'ganada' ? 'Horas ganadas' : 'Recompensa canjeada'} · {evento.detalle}</p>
                  <p className="history-muted text-sm">{evento.fecha}</p>
                  {evento.bono_favorito > 0 && <p className="history-subtle text-xs">Incluye bono de {evento.bono_favorito} horas por cubículo favorito.</p>}
                </div>
                <strong className={evento.horas < 0 ? 'history-hours-negative' : 'history-hours-positive'}>
                  {evento.horas > 0 ? '+' : ''}{(Number(evento.horas) + Number(evento.bono_favorito || 0)).toFixed(2)} horas
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="history-muted">Aún no tienes horas ganadas ni canjes.</p>
        )}
      </section>
    </div>
  )
}
