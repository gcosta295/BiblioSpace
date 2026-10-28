import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../hooks/useLibrary'
import { APERTURA, CIERRE, MAX_RESERVAS_DIA, MIN_PERSONAS, validarInvitado } from '../services/reservationRules'
import { aHoras, conocidos, estadoVisible, horaActual, horaTexto, hoyISO, miembrosDe, reservaVigente } from '../utils/time'
import CubicleMap from '../components/map/CubicleMap'
import Legend from '../components/map/Legend'
import MemberPicker from '../components/reservations/MemberPicker'
import ReservationModal from '../components/reservations/ReservationModal'
import completedIcon from '../assets/stats-completed.png'
import hoursIcon from '../assets/stats-hours.png'
import cancellationsIcon from '../assets/stats-cancellations.png'

const HORAS = Array.from({ length: CIERRE - APERTURA }, (_, index) => APERTURA + index)

function fechaLocal(fecha) {
  const [ano, mes, dia] = String(fecha).slice(0, 10).split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function esMismaPersona(reserva, correo) {
  return (
    String(reserva.Correo_Estudiante).toLowerCase() === correo ||
    miembrosDe(reserva).includes(correo)
  )
}

export default function MapPage() {
  const { correo, rol } = useAuth()
  const { cubiculos, reservas, cargando, error, recargar } = useLibrary()
  const [fecha, setFecha] = useState(hoyISO)
  const [hora, setHora] = useState(() => Math.min(Math.max(horaActual(), APERTURA), CIERRE - 1))
  const [duracion, setDuracion] = useState(1)
  const [piso, setPiso] = useState(1)
  const [seleccionado, setSeleccionado] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [aviso, setAviso] = useState('')

  const pisos = [...new Set(cubiculos.map((cubiculo) => Number(cubiculo.Piso)))].sort((a, b) => a - b)
  const usuarioReservas = useMemo(
    () => reservas.filter((reserva) => correo && esMismaPersona(reserva, correo)),
    [reservas, correo],
  )
  const reservaActiva = correo ? reservaVigente(reservas, correo) : null

  const estadisticas = useMemo(() => {
    const hoy = fechaLocal(hoyISO())
    const inicioSemana = new Date(hoy)
    inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    const finSemana = new Date(inicioSemana)
    finSemana.setDate(finSemana.getDate() + 7)

    const completadasSemana = usuarioReservas.filter((reserva) => {
      const fechaReserva = fechaLocal(reserva.Fecha)
      return (
        estadoVisible(reserva) === 'Finalizada' &&
        fechaReserva >= inicioSemana &&
        fechaReserva < finSemana
      )
    })
    const horas = completadasSemana.reduce((total, reserva) => {
      const [inicio, fin] = aHoras(reserva.Franja_Horaria)
      return total + fin - inicio
    }, 0)
    const cancelacionesHoy = usuarioReservas.filter(
      (reserva) =>
        reserva.Estado === 'Cancelada' &&
        String(reserva.Fecha_Cancelacion || '').slice(0, 10) === hoyISO(),
    ).length

    return { horas, completadas: completadasSemana.length, cancelacionesHoy }
  }, [usuarioReservas])

  const cambiarPiso = (nuevoPiso) => {
    setPiso(nuevoPiso)
    setSeleccionado(null)
    setMiembros([])
  }

  const seleccionarCubiculo = (cubiculo) => {
    if (
      !seleccionado ||
      Number(seleccionado.Piso) !== Number(cubiculo.Piso) ||
      Number(seleccionado.ID_Cubiculo) !== Number(cubiculo.ID_Cubiculo)
    ) {
      setMiembros([])
    }
    setSeleccionado(cubiculo)
  }

  const agregarMiembro = (miembro) => {
    if (!seleccionado) return 'Selecciona primero un cubículo disponible.'
    const errorMiembro = validarInvitado({
      reservas,
      correo: miembro,
      actuales: [correo, ...miembros],
      cub: seleccionado,
    })
    if (!errorMiembro) setMiembros((actuales) => [...actuales, miembro])
    return errorMiembro
  }

  const quitarMiembro = (miembro) => {
    setMiembros((actuales) => actuales.filter((actual) => actual !== miembro))
    return null
  }

  const nombreTitular = correo
    ? correo
        .split('@')[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(' ') + ' (tú)'
    : 'Guarda tu correo institucional'

  const cambiarHora = (nuevaHora) => {
    setHora(nuevaHora)
    if (nuevaHora + duracion > CIERRE) setDuracion(1)
  }

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <h1>Reserva tu espacio de estudio</h1>
        <p>Encuentra y reserva el cubículo que desees.</p>
      </div>

      <div className="dashboard-grid">
        <section className="map-column" aria-label="Mapa de cubículos">
          <div className="map-toolbar">
            <div className="floor-tabs" role="group" aria-label="Seleccionar piso">
              {(pisos.length ? pisos : [1]).map((numeroPiso) => (
                <button
                  key={numeroPiso}
                  type="button"
                  aria-pressed={piso === numeroPiso}
                  className={`floor-tab${piso === numeroPiso ? ' is-active' : ''}`}
                  onClick={() => cambiarPiso(numeroPiso)}
                >
                  Piso {numeroPiso}
                </button>
              ))}
            </div>
            <Legend />
          </div>

          {cargando && <p className="map-message">Cargando cubículos…</p>}
          {error && !cargando && (
            <div className="map-message map-message-error" role="alert">
              No se pudieron cargar los cubículos.{' '}
              <button type="button" onClick={recargar}>Intentar de nuevo</button>
            </div>
          )}
          {!cargando && !error && cubiculos.length > 0 && (
            <CubicleMap
              cubiculos={cubiculos}
              reservas={reservas}
              piso={piso}
              fecha={fecha}
              hora={hora}
              seleccionado={seleccionado}
              esAdmin={rol === 'admin'}
              onSelect={seleccionarCubiculo}
            />
          )}
          {!cargando && !error && cubiculos.length === 0 && (
            <p className="map-message">Aún no hay cubículos registrados.</p>
          )}
        </section>

        <aside className="reservation-column">
          <section className="booking-panel" aria-labelledby="booking-title">
            <h2 id="booking-title">Escoge tu cubículo</h2>
            <div className="booking-content">
              <div className="booking-fields">
                <label>
                  <span>Horario de reserva</span>
                  <select value={hora} onChange={(event) => cambiarHora(Number(event.target.value))}>
                    {HORAS.map((value) => (
                      <option key={value} value={value}>{horaTexto(value)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Duración</span>
                  <select value={duracion} onChange={(event) => setDuracion(Number(event.target.value))}>
                    <option value={1}>1 hora</option>
                    {hora + 2 <= CIERRE && <option value={2}>2 horas</option>}
                  </select>
                </label>
                <label className="booking-date">
                  <span>Fecha de reserva</span>
                  <input
                    type="date"
                    min={hoyISO()}
                    value={fecha}
                    onChange={(event) => setFecha(event.target.value)}
                  />
                </label>
              </div>
              <p className="booking-note">Máximo 2 horas por reserva · De {APERTURA}:00 a {CIERRE}:00</p>

              {seleccionado && (
                <p className="booking-selection">
                  Cubículo {seleccionado.ID_Cubiculo} · Piso {seleccionado.Piso}
                </p>
              )}

              <div className="booking-members">
                <p className="booking-members-label">
                  Integrantes del grupo ({1 + miembros.length}/{seleccionado ? seleccionado.Capacidad : 6}) · mínimo {MIN_PERSONAS}
                </p>
                {correo ? (
                  <MemberPicker
                    titular={correo}
                    titularLabel={nombreTitular}
                    titularSuffix="Propietario"
                    miembros={miembros}
                    sugerencias={conocidos(reservas)}
                    onAdd={agregarMiembro}
                    onRemove={quitarMiembro}
                    className="member-picker-compact"
                  />
                ) : (
                  <div className="selected-cubicle">
                    <span className="selection-indicator" aria-hidden="true" />
                    <strong>Guarda tu correo institucional en tu perfil</strong>
                  </div>
                )}
              </div>

              {seleccionado && (
                <p className="booking-note">
                  {fecha} · {horaTexto(hora)}–{horaTexto(hora + duracion)}
                </p>
              )}
              <button
                type="button"
                className="booking-submit"
                disabled={!seleccionado || !correo || cargando || miembros.length < MIN_PERSONAS - 1}
                onClick={() => setMostrarModal(true)}
              >
                {seleccionado ? 'Confirmar Reserva' : 'Selecciona un cubículo'}
              </button>
            </div>
          </section>

          <section className="active-reservation" aria-labelledby="active-reservation-title">
            <h2 id="active-reservation-title">Mi Reserva Activa</h2>
            {cargando ? (
              <div className="active-reservation-card"><span>Consultando tus reservas…</span></div>
            ) : error ? (
              <div className="active-reservation-card"><span>No se pudo consultar tu reserva.</span></div>
            ) : reservaActiva ? (
              <div className="active-reservation-card">
                <strong>Cubículo {reservaActiva.ID_Cubiculo} · Piso {reservaActiva.Piso}</strong>
                <span>{reservaActiva.Fecha} · {reservaActiva.Franja_Horaria}</span>
                <Link to="/mi-reserva">Ver y administrar reserva</Link>
              </div>
            ) : (
              <div className="active-reservation-card">
                <span>{correo ? 'No tienes una reserva activa.' : 'Guarda tu correo para consultar tus reservas.'}</span>
                {correo && <Link to="/historial">Ver mis reservas</Link>}
              </div>
            )}
          </section>
        </aside>
      </div>

      {aviso && <p className="booking-success" role="status">{aviso}</p>}

      <section className="stats-section" aria-labelledby="stats-title">
        <div className="stats-heading">
          <h2 id="stats-title">Estadísticas Personales</h2>
          <p>Resumen de tus actividades esta semana:</p>
        </div>
        <div className="stats-grid">
          <article className="stat-card stat-hours">
            <span className="stat-icon"><img src={hoursIcon} alt="" /></span>
            <div><strong>{estadisticas.horas} {estadisticas.horas === 1 ? 'hora' : 'horas'}</strong><span>Estudiadas en la semana</span></div>
          </article>
          <article className="stat-card stat-completed">
            <span className="stat-icon"><img src={completedIcon} alt="" /></span>
            <div><strong>{estadisticas.completadas}</strong><span>Reservas completadas</span></div>
          </article>
          <article className="stat-card stat-cancellations">
            <span className="stat-icon"><img src={cancellationsIcon} alt="" /></span>
            <div><strong>{estadisticas.cancelacionesHoy}/{MAX_RESERVAS_DIA}</strong><span>Cancelaciones hoy</span></div>
          </article>
        </div>
      </section>

      {mostrarModal && seleccionado && (
        <ReservationModal
          cub={seleccionado}
          reservas={reservas}
          fecha={fecha}
          hora={hora}
          duracionInicial={duracion}
          integrantesIniciales={miembros}
          onClose={() => setMostrarModal(false)}
          onCreated={(mensaje) => {
            setMostrarModal(false)
            setSeleccionado(null)
            setMiembros([])
            setAviso(mensaje)
            recargar()
          }}
        />
      )}
    </div>
  )
}
