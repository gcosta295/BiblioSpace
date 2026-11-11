import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationsContext'

// El color del punto dice de qué se trata sin tener que leer el título.
const TONO = {
  RESERVA_CREADA: 'verde',
  RESERVA_COMPLETADA: 'gris',
  RESERVA_CANCELADA: 'naranja',
  RESERVA_EXPIRADA: 'gris',
  LIBERACION: 'rojo',
}

const tiempoRelativo = (fecha) => {
  const marca = new Date(String(fecha).replace(' ', 'T')).getTime()
  if (!Number.isFinite(marca)) return String(fecha)
  const minutos = Math.max(0, Math.floor((Date.now() - marca) / 60000))
  if (minutos < 1) return 'Hace un momento'
  if (minutos < 60) return `Hace ${minutos} minuto${minutos === 1 ? '' : 's'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Hace ${horas} hora${horas === 1 ? '' : 's'}`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `Hace ${dias} día${dias === 1 ? '' : 's'}`
  return String(fecha).slice(0, 10)
}

export default function NotificationsPage() {
  const { notificaciones, listo, marcarLeidas } = useNotifications()
  // Se guardan cuáles estaban sin leer al entrar, para poder marcarlas en la lista
  // aunque el contador de la campana ya se haya apagado.
  const [nuevas, setNuevas] = useState(null)

  useEffect(() => {
    if (!listo || nuevas) return
    setNuevas(new Set(notificaciones.filter((n) => n.No_Leida).map((n) => n.ID)))
    marcarLeidas()
  }, [listo, notificaciones, nuevas, marcarLeidas])

  const sinLeerAlEntrar = nuevas ? nuevas.size : 0

  return (
    <section className="notifs">
      <header className="notifs-header">
        <h1>Notificaciones</h1>
        <p>
          {!listo
            ? 'Cargando…'
            : sinLeerAlEntrar > 0
              ? `Tienes ${sinLeerAlEntrar} ${sinLeerAlEntrar === 1 ? 'novedad' : 'novedades'} desde la última vez.`
              : 'Todo lo que pasa con tus reservas aparece aquí.'}
        </p>
      </header>

      {listo && notificaciones.length === 0 ? (
        <div className="notifs-vacio">
          <p>Todavía no tienes notificaciones.</p>
          <p>
            Cuando reserves un cubículo te avisamos aquí.{' '}
            <Link to="/">Ver el mapa</Link>
          </p>
        </div>
      ) : (
        <ul className="notifs-lista">
          {notificaciones.map((n) => (
            <li key={n.ID} className={`notifs-item${nuevas?.has(n.ID) ? ' es-nueva' : ''}`}>
              <span className={`notifs-punto ${TONO[n.Tipo] || 'gris'}`} aria-hidden="true" />
              <div className="notifs-texto">
                <p className="notifs-titulo">
                  {n.Titulo}
                  {nuevas?.has(n.ID) && <span className="notifs-chip">Nueva</span>}
                </p>
                <p className="notifs-detalle">{n.Detalle}</p>
                <p className="notifs-cuando">
                  <time dateTime={String(n.Fecha).replace(' ', 'T')}>{tiempoRelativo(n.Fecha)}</time>
                  {' · '}Cubículo {n.ID_Cubiculo} · Piso {n.Piso}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
