import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { crearCubiculo } from '../api/sheets'
import BlockToggle from '../components/admin/BlockToggle'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../hooks/useLibrary'
import { MAX_PERSONAS } from '../services/reservationRules'
import { aHoras, estadoCubiculo, hoyISO, horaActual, OCUPA } from '../utils/time'

import logo from '../assets/admin/admin-bibliospace-logo.png'
import searchIcon from '../assets/admin/search.svg'
import notificationIcon from '../assets/admin/notification.svg'
import trendUpIcon from '../assets/admin/trend-up.svg'
import trendDownIcon from '../assets/admin/trend-down.svg'
import keyIcon from '../assets/admin/table-key.svg'
import lockIcon from '../assets/admin/table-lock.svg'
import activityIcon from '../assets/admin/activity.svg'
import orangeBullet from '../assets/admin/activity-orange.svg'
import redBullet from '../assets/admin/activity-red.svg'
import grayBullet from '../assets/admin/activity-gray.svg'
import dashboardIcon from '../assets/admin/nav-dashboard.svg'
import cubiclesIcon from '../assets/admin/nav-cubicles.svg'
import usersIcon from '../assets/admin/nav-users.svg'
import navActivityIcon from '../assets/admin/nav-activity.svg'
import settingsIcon from '../assets/admin/nav-settings.svg'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: dashboardIcon, page: true },
  { label: 'Cubículos', href: '#cubiculos', icon: cubiclesIcon },
  { label: 'Usuarios', href: '/historial', icon: usersIcon, page: true },
  { label: 'Log de Actividad', href: '#actividad', icon: navActivityIcon },
  { label: 'Configuración', href: '#registro', icon: settingsIcon },
]

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatHour = (hour) => {
  if (!Number.isFinite(hour)) return '—'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelveHour = hour % 12 || 12
  return `${String(twelveHour).padStart(2, '0')}:00 ${suffix}`
}

const displayName = (reservation) => {
  if (reservation.Nombre) return reservation.Nombre
  const email = String(reservation.Correo_Estudiante || '').split('@')[0]
  return email
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Usuario'
}

const averageReservationHours = (reservations, date) => {
  const matching = reservations.filter(
    (reservation) => reservation.Fecha === date && OCUPA.includes(reservation.Estado),
  )
  if (!matching.length) return 0
  const total = matching.reduce((sum, reservation) => {
    const [start, end] = aHoras(reservation.Franja_Horaria)
    return sum + (Number.isFinite(start) && Number.isFinite(end) ? end - start : 0)
  }, 0)
  return total / matching.length
}

const cubicleReservation = (cubicle, reservations, date, hour) => {
  if (cubicle.Estado === 'Bloqueado') return { status: 'bloqueado', reservation: null }

  const current = estadoCubiculo(cubicle, reservations, date, hour).reserva
  if (current) {
    return {
      status: current.Estado === 'Activa' ? 'ocupado' : 'reservado',
      reservation: current,
    }
  }

  const next = reservations
    .filter((reservation) => {
      if (!OCUPA.includes(reservation.Estado) || reservation.Fecha !== date) return false
      if (Number(reservation.Piso) !== Number(cubicle.Piso)) return false
      if (Number(reservation.ID_Cubiculo) !== Number(cubicle.ID_Cubiculo)) return false
      const [start] = aHoras(reservation.Franja_Horaria)
      return start >= hour
    })
    .sort((first, second) => aHoras(first.Franja_Horaria)[0] - aHoras(second.Franja_Horaria)[0])[0]

  return next
    ? { status: 'reservado', reservation: next }
    : { status: 'disponible', reservation: null }
}

const activityFor = (reservation) => {
  const cubicle = `C${reservation.ID_Cubiculo} Piso ${reservation.Piso}`
  const time = formatHour(aHoras(reservation.Franja_Horaria)[0])
  const name = displayName(reservation)
  const activity = {
    Pendiente: {
      title: 'Reserva Pendiente',
      detail: `${name} solicitó ${cubicle} para las ${time}.`,
      icon: orangeBullet,
    },
    Activa: {
      title: 'Reserva Confirmada',
      detail: `${name} reservó ${cubicle} para las ${time}.`,
      icon: orangeBullet,
    },
    Cancelada: {
      title: 'Reserva Cancelada',
      detail: `La reserva de ${cubicle} fue cancelada por ${name}.`,
      icon: redBullet,
    },
    Expirada: {
      title: 'Reserva Expirada',
      detail: `La reserva de ${cubicle} ha finalizado automáticamente.`,
      icon: grayBullet,
    },
  }
  const item = activity[reservation.Estado] || {
    title: 'Reserva Actualizada',
    detail: `Se actualizó la reserva de ${cubicle}.`,
    icon: grayBullet,
  }
  const createdAt = String(reservation.Fecha_Creacion || '').replace(' ', 'T')
  const timestamp = new Date(createdAt).getTime()
  const minutes = Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 60000)) : null
  const relativeTime = minutes === null
    ? reservation.Fecha || ''
    : minutes < 1
      ? 'Hace un momento'
      : minutes < 60
        ? `Hace ${minutes} minuto${minutes === 1 ? '' : 's'}`
        : minutes < 1440
          ? `Hace ${Math.floor(minutes / 60)} hora${Math.floor(minutes / 60) === 1 ? '' : 's'}`
          : `Hace ${Math.floor(minutes / 1440)} día${Math.floor(minutes / 1440) === 1 ? '' : 's'}`

  return { ...item, relativeTime, timestamp }
}

function StatCard({ label, value, hint, accent, progress, trend }) {
  return (
    <article className="admin-stat-card">
      <p className="admin-stat-label">{label}</p>
      <div className="admin-stat-value-row">
        <strong className={accent ? `admin-stat-value ${accent}` : 'admin-stat-value'}>{value}</strong>
        {trend ? (
          <span className={`admin-stat-trend ${trend.direction}`}>
            <img src={trend.icon} alt="" />
            {trend.label}
          </span>
        ) : (
          <span className="admin-stat-hint">{hint}</span>
        )}
      </div>
      {progress !== undefined && (
        <div
          className="admin-stat-progress"
          role="progressbar"
          aria-label="Porcentaje de cubículos en uso"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
    </article>
  )
}

function UsageChart({ reservations, date }) {
  const days = useMemo(() => {
    const today = new Date(`${date}T00:00:00`)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setDate(today.getDate() - (6 - index))
      const dayKey = formatDate(day)
      const count = reservations.filter(
        (reservation) => reservation.Fecha === dayKey && OCUPA.includes(reservation.Estado),
      ).length
      return {
        label: day.toLocaleDateString('es', { weekday: 'short' }).replace('.', '').toUpperCase(),
        count,
      }
    })
  }, [date, reservations])
  const maximum = Math.max(1, ...days.map((day) => day.count))

  return (
    <section className="admin-panel admin-usage-panel" aria-labelledby="usage-heading">
      <h2 id="usage-heading">Estadísticas de Uso Diario</h2>
      <div className="admin-chart" role="img" aria-label="Reservas activas y pendientes de los últimos siete días">
        {days.map((day) => (
          <div className="admin-chart-column" key={day.label}>
            <div className="admin-chart-track">
              <span
                className={day.count === maximum && day.count > 0 ? 'is-highlighted' : ''}
                style={{ height: `${day.count ? Math.max(18, (day.count / maximum) * 100) : 8}%` }}
                title={`${day.count} reservas`}
              />
            </div>
            <span className="admin-chart-label">{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function AdminPage() {
  const { correo } = useAuth()
  const { cubiculos, reservas, cargando, error, recargar } = useLibrary()
  const [aviso, setAviso] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [piso, setPiso] = useState(1)
  const [pisoNuevo, setPisoNuevo] = useState(1)
  const [capacidad, setCapacidad] = useState(MAX_PERSONAS)
  const [enviando, setEnviando] = useState(false)

  const hoy = hoyISO()
  const hora = horaActual()
  const floors = useMemo(
    () => [...new Set([1, 2, ...cubiculos.map((cubicle) => Number(cubicle.Piso))])].sort((a, b) => a - b),
    [cubiculos],
  )
  const todaysReservations = reservas.filter(
    (reservation) => reservation.Fecha === hoy && OCUPA.includes(reservation.Estado),
  )
  const occupiedCount = cubiculos.filter(
    (cubicle) => cubicleReservation(cubicle, reservas, hoy, hora).status === 'ocupado',
  ).length
  const blockedCount = cubiculos.filter((cubicle) => cubicle.Estado === 'Bloqueado').length
  const occupancy = cubiculos.length ? Math.round((occupiedCount / cubiculos.length) * 100) : 0
  const averageHours = averageReservationHours(reservas, hoy)
  const yesterday = new Date(`${hoy}T00:00:00`)
  yesterday.setDate(yesterday.getDate() - 1)
  const previousAverageHours = averageReservationHours(reservas, formatDate(yesterday))
  const usageChange = previousAverageHours
    ? Math.round(((averageHours - previousAverageHours) / previousAverageHours) * 100)
    : null
  const usageTrend = usageChange === null
    ? undefined
    : {
        direction: usageChange >= 0 ? 'up' : 'down',
        icon: usageChange >= 0 ? trendUpIcon : trendDownIcon,
        label: `${Math.abs(usageChange)}%`,
      }
  const nextCubicleId = Math.max(
    0,
    ...cubiculos
      .filter((cubicle) => Number(cubicle.Piso) === pisoNuevo)
      .map((cubicle) => Number(cubicle.ID_Cubiculo)),
  ) + 1

  const visibleCubicles = cubiculos
    .filter((cubicle) => Number(cubicle.Piso) === piso)
    .map((cubicle) => ({
      cubicle,
      ...cubicleReservation(cubicle, reservas, hoy, hora),
    }))
    .filter(({ cubicle, status, reservation }) => {
      const term = busqueda.trim().toLocaleLowerCase()
      if (!term) return true
      return [
        cubicle.ID_Cubiculo,
        cubicle.Piso,
        status,
        reservation ? displayName(reservation) : '',
        reservation?.Correo_Estudiante || '',
      ].some((value) => String(value).toLocaleLowerCase().includes(term))
    })
    .sort((first, second) => Number(first.cubicle.ID_Cubiculo) - Number(second.cubicle.ID_Cubiculo))

  const recentActivities = [...reservas]
    .map(activityFor)
    .sort((first, second) => (second.timestamp || 0) - (first.timestamp || 0))
    .slice(0, 4)

  const adminName = correo
    ? correo.split('@')[0].split(/[._-]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
    : 'Administrador'
  const informarCambio = (mensaje) => {
    setAviso({ tipo: 'ok', texto: mensaje })
    recargar()
  }

  const enviarFormulario = async (event) => {
    event.preventDefault()
    setEnviando(true)
    const result = await crearCubiculo(correo, pisoNuevo, capacidad)
    setEnviando(false)
    if (result.status === 'ok') {
      setAviso({ tipo: 'ok', texto: `Cubículo ${result.id} agregado al Piso ${pisoNuevo}.` })
      recargar()
    } else {
      setAviso({ tipo: 'error', texto: result.mensaje || 'No se pudo agregar el cubículo.' })
    }
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <nav className="admin-sidebar-nav" aria-label="Navegación de administración">
          {navItems.map((item) => {
            const content = (
              <>
                <span className="admin-nav-icon"><img src={item.icon} alt="" /></span>
                <span>{item.label}</span>
              </>
            )
            return item.page ? (
              <NavLink
                key={item.label}
                to={item.href}
                end={item.href === '/admin'}
                className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}
              >
                {content}
              </NavLink>
            ) : (
              <a className="admin-nav-link" href={item.href} key={item.label}>
                {content}
              </a>
            )
          })}
        </nav>

        <div className="admin-sidebar-brand">
          <img src={logo} alt="BiblioSpace — Biblioteca Universidad Metropolitana" />
        </div>
        <div className="admin-sidebar-profile">
          <span className="admin-profile-copy">
            <strong>{adminName}</strong>
            <span>Administrador</span>
          </span>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header" id="dashboard">
          <div>
            <h1>Gestión de Biblioteca</h1>
            <p>Panel de control en tiempo real.</p>
          </div>
          <div className="admin-header-actions">
            <label className="admin-search">
              <span className="admin-icon-box"><img src={searchIcon} alt="" /></span>
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar cubículo o usuario..."
                aria-label="Buscar cubículo o usuario"
              />
            </label>
            <a className="admin-notifications" href="#actividad" aria-label="Ver log de actividad">
              <img src={notificationIcon} alt="" />
              {recentActivities.length > 0 && <span className="admin-notification-dot" />}
            </a>
          </div>
        </header>

        <section className="admin-stats" aria-label="Resumen de la biblioteca">
          <StatCard
            label="Cubículos en uso"
            value={`${occupiedCount} / ${cubiculos.length}`}
            hint={cubiculos.length ? 'Aforo actual' : 'Sin cubículos'}
            progress={occupancy}
          />
          <StatCard label="Reservas hoy" value={todaysReservations.length} hint="En tiempo real" />
          <StatCard label="Bloqueos activos" value={blockedCount} hint="Mantenimiento" accent="is-alert" />
          <StatCard
            label="Promedio de uso"
            value={`${averageHours.toFixed(1)}h`}
            hint="Por reserva"
            trend={usageTrend}
          />
        </section>

        {aviso && (
          <p className={`admin-notice ${aviso.tipo}`} role="status">
            {aviso.texto}
          </p>
        )}
        {error && !cargando && (
          <div className="admin-error" role="alert">
            <span>No se pudieron cargar los datos de la biblioteca.</span>
            <button type="button" onClick={recargar}>Reintentar</button>
          </div>
        )}

        <div className="admin-content-grid">
          <div className="admin-primary-column">
            <section className="admin-panel admin-cubicles-panel" id="cubiculos" aria-labelledby="cubicles-heading">
              <div className="admin-panel-heading">
                <h2 id="cubicles-heading">Estado de Cubículos</h2>
                <div className="admin-floor-tabs" aria-label="Filtrar por piso">
                  {floors.map((floor) => (
                    <button
                      type="button"
                      className={floor === piso ? 'is-active' : ''}
                      aria-pressed={floor === piso}
                      key={floor}
                      onClick={() => setPiso(floor)}
                    >
                      Piso {floor}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-table-scroll">
                <table className="admin-cubicles-table">
                  <thead>
                    <tr>
                      <th scope="col">Cubículo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Reservado por</th>
                      <th scope="col">Fin turno</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando && cubiculos.length === 0 ? (
                      <tr><td className="admin-table-message" colSpan="5">Cargando cubículos…</td></tr>
                    ) : visibleCubicles.length ? (
                      visibleCubicles.map(({ cubicle, status, reservation }) => (
                        <tr key={`${cubicle.Piso}-${cubicle.ID_Cubiculo}`}>
                          <td className="admin-cubicle-id">{cubicle.ID_Cubiculo}</td>
                          <td>
                            <span className={`admin-status-badge ${status}`}>
                              {status === 'disponible' ? 'Disponible' : status === 'ocupado' ? 'En uso' : status === 'reservado' ? 'Reservado' : 'Bloqueado'}
                            </span>
                          </td>
                          <td className="admin-table-person">{reservation ? displayName(reservation) : '—'}</td>
                          <td className="admin-table-time">
                            {reservation ? formatHour(aHoras(reservation.Franja_Horaria)[1]) : '—'}
                          </td>
                          <td>
                            <div className="admin-row-actions">
                              {(status === 'ocupado' || status === 'reservado') && (
                                <span className="admin-icon-box orange" aria-hidden="true" title="Reserva activa">
                                  <img src={keyIcon} alt="" />
                                </span>
                              )}
                              <BlockToggle
                                cub={cubicle}
                                correo={correo}
                                compact
                                icon={lockIcon}
                                onChanged={informarCambio}
                                onError={(texto) => setAviso({ tipo: 'error', texto })}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="admin-table-message" colSpan="5">
                          {busqueda ? 'No hay coincidencias en este piso.' : 'No hay cubículos registrados en este piso.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <UsageChart reservations={reservas} date={hoy} />
          </div>

          <div className="admin-secondary-column">
            <section className="admin-panel admin-activity-panel" id="actividad" aria-labelledby="activity-heading">
              <div className="admin-panel-heading">
                <h2 id="activity-heading">
                  <span className="admin-icon-box"><img src={activityIcon} alt="" /></span>
                  Log de Actividad
                </h2>
              </div>
              <div className="admin-activity-list">
                {recentActivities.length ? recentActivities.map((activity, index) => (
                  <article className="admin-activity-item" key={`${activity.title}-${index}`}>
                    <img src={activity.icon} alt="" />
                    <div>
                      <h3>{activity.title}</h3>
                      <p>{activity.detail}</p>
                      <time>{activity.relativeTime}</time>
                    </div>
                  </article>
                )) : (
                  <p className="admin-activity-empty">No hay actividad reciente.</p>
                )}
              </div>
            </section>

            <section className="admin-panel admin-registration-panel" id="registro" aria-labelledby="registration-heading">
              <h2 id="registration-heading">Registro de Cubículo</h2>
              <form onSubmit={enviarFormulario}>
                <label className="admin-form-field">
                  <span>Nombre/ID</span>
                  <input value={`Cubículo ${nextCubicleId}`} readOnly aria-label="Identificador que se asignará al cubículo" />
                </label>
                <label className="admin-form-field">
                  <span>Piso</span>
                  <select value={pisoNuevo} onChange={(event) => setPisoNuevo(Number(event.target.value))}>
                    {floors.map((floor) => <option key={floor} value={floor}>Piso {floor}</option>)}
                  </select>
                </label>
                <details className="admin-capacity-options">
                  <summary>Opciones avanzadas</summary>
                  <label className="admin-form-field">
                    <span>Capacidad (máx. {MAX_PERSONAS})</span>
                    <input
                      type="number"
                      min="1"
                      max={MAX_PERSONAS}
                      value={capacidad}
                      onChange={(event) => setCapacidad(Number(event.target.value))}
                    />
                  </label>
                </details>
                <button type="submit" disabled={enviando || !correo}>
                  {enviando ? 'Agregando…' : 'Agregar a la Red'}
                </button>
                {!correo && <p className="admin-form-help">Configura tu correo institucional para continuar.</p>}
              </form>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
