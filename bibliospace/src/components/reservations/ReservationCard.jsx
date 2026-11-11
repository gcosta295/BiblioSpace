import { useEffect, useState } from 'react'
import {
  abandonarReserva,
  agregarMiembro,
  obtenerAsistenciaReserva,
  quitarMiembro,
  registrarCheckIn,
  registrarCheckOut,
} from '../../api/library'
import { useAuth } from '../../context/AuthContext'
import { CANCELAR_ANTES_MIN, capacidadDe, MIN_PERSONAS, puedeCancelar, validarInvitado } from '../../services/reservationRules'
import { conocidos, miembrosDe } from '../../utils/time'
import CancelDialog from './CancelDialog'
import MemberPicker from './MemberPicker'

export default function ReservationCard({ reserva, cub, reservas, correo, onChanged }) {
  const [cancelando, setCancelando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [asistencia, setAsistencia] = useState({ check_in_at: null, check_out_at: null })
  const [asistenciaError, setAsistenciaError] = useState('')
  const [asistenciaEnviando, setAsistenciaEnviando] = useState(false)
  const [horasGanadas, setHorasGanadas] = useState(null)
  const [dentroHorario, setDentroHorario] = useState(false)
  const { horasRecompensas, refrescarRecompensas } = useAuth()
  const titular = String(reserva.Correo_Estudiante).toLowerCase()
  const miembros = miembrosDe(reserva)
  const esTitular = titular === correo
  const [horaInicio, horaFin] = String(reserva.Franja_Horaria).split('-')
  const inicioReserva = new Date(`${reserva.Fecha}T${horaInicio}:00-04:00`).getTime()
  const finReserva = new Date(`${reserva.Fecha}T${horaFin}:00-04:00`).getTime()
  const tieneProteccion = horasRecompensas.reservaCancelacionProtegida === reserva.ID_Reserva

  useEffect(() => {
    const actualizarHorario = () => setDentroHorario(Date.now() >= inicioReserva && Date.now() < finReserva)
    const inicio = window.setTimeout(actualizarHorario, 0)
    const intervalo = window.setInterval(actualizarHorario, 30000)
    return () => {
      window.clearTimeout(inicio)
      window.clearInterval(intervalo)
    }
  }, [inicioReserva, finReserva])

  useEffect(() => {
    let activo = true
    obtenerAsistenciaReserva(correo, reserva.ID_Reserva).then((res) => {
      if (!activo) return
      if (res.status !== 'ok') {
        setAsistenciaError(res.mensaje || 'No se pudo consultar la asistencia.')
        return
      }
      setAsistencia({ check_in_at: res.check_in_at, check_out_at: res.check_out_at })
    }).catch((error) => {
      console.error('Error al consultar el check-in y check-out:', error)
      if (activo) setAsistenciaError('No se pudo consultar la asistencia.')
    })
    return () => {
      activo = false
    }
  }, [correo, reserva.ID_Reserva])

  const registrarAsistencia = async (checkIn) => {
    setAsistenciaEnviando(true)
    const res = checkIn
      ? await registrarCheckIn(correo, reserva.ID_Reserva)
      : await registrarCheckOut(correo, reserva.ID_Reserva)
    setAsistenciaEnviando(false)
    if (res.status !== 'ok') {
      setAsistenciaError(res.mensaje || 'No se pudo registrar la asistencia.')
      return
    }
    setAsistencia((actual) => checkIn
      ? { ...actual, check_in_at: res.check_in_at }
      : { ...actual, check_out_at: new Date().toISOString() })
    setAsistenciaError('')
    if (!checkIn) {
      setHorasGanadas(Number(res.horas_ganadas) || 0)
      const actualizacion = await refrescarRecompensas()
      if (actualizacion.status !== 'ok') {
        setAsistenciaError('El check-out se registró, pero no se pudo actualizar tu saldo de horas.')
      }
    }
    onChanged(checkIn ? 'Check-in registrado.' : 'Check-out registrado; tus horas ya fueron acreditadas.')
  }

  const agregar = async (m) => {
    const err = validarInvitado({ reservas, correo: m, actuales: [titular, ...miembros], cub })
    if (err) return err
    const res = await agregarMiembro(correo, reserva.ID_Reserva, m)
    if (res.status !== 'ok') return res.mensaje || 'No se pudo agregar.'
    onChanged('Integrante agregado.')
    return null
  }

  const abandonar = async () => {
    if (!window.confirm('¿Seguro que quieres abandonar este cubículo?')) return
    const res = await abandonarReserva(correo, reserva.ID_Reserva)
    if (res.status === 'ok') onChanged(res.mensaje)
    else setErrorGlobal(res.mensaje || 'No se pudo abandonar la reserva.')
  }

  const quitar = async (m) => {
    if (miembros.length < MIN_PERSONAS) {
      return `Se necesitan al menos ${MIN_PERSONAS} personas. Cancela la reserva si ya no la usarán.`
    }
    const res = await quitarMiembro(correo, reserva.ID_Reserva, m)
    if (res.status !== 'ok') return res.mensaje || 'No se pudo quitar.'
    onChanged('Integrante eliminado.')
    return null
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Cubículo {reserva.ID_Cubiculo} · Piso {reserva.Piso}
        </h2>
        <p className="text-slate-600">
          {reserva.Fecha} · {reserva.Franja_Horaria}
        </p>
      </div>
      <div>
        <p className="mb-1 text-sm text-slate-500">
          Integrantes ({1 + miembros.length}/{capacidadDe(cub)})
        </p>
        <MemberPicker
          titular={titular}
          miembros={miembros}
          sugerencias={conocidos(reservas)}
          onAdd={agregar}
          onRemove={quitar}
          readOnly={!esTitular}
        />
        {!esTitular && <p className="mt-2 text-xs text-slate-500">Solo el titular puede modificar o cancelar la reserva.</p>}
      </div>
      <section className="space-y-2 rounded-lg bg-slate-50 p-3" aria-label="Asistencia de la reserva">
        <h3 className="text-sm font-semibold">Check-in y check-out</h3>
        {asistencia.check_out_at ? (
          <p className="text-sm text-emerald-700">
            Asistencia completada · {horasGanadas === null ? 'horas acreditadas' : `${horasGanadas.toFixed(2)} horas acreditadas`}
          </p>
        ) : dentroHorario && !asistencia.check_in_at ? (
          <button type="button" disabled={asistenciaEnviando} onClick={() => registrarAsistencia(true)} className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">
            {asistenciaEnviando ? 'Registrando…' : 'Registrar check-in'}
          </button>
        ) : dentroHorario && asistencia.check_in_at ? (
          <>
            <p className="text-sm text-slate-600">Check-in registrado. Marca tu salida al terminar.</p>
            <button type="button" disabled={asistenciaEnviando} onClick={() => registrarAsistencia(false)} className="rounded-md bg-indigo-700 px-3 py-2 text-sm text-white disabled:opacity-50">
              {asistenciaEnviando ? 'Registrando…' : 'Registrar check-out'}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            {asistencia.check_in_at ? 'El check-out debe registrarse antes de que termine la reserva.' : 'El check-in estará disponible durante el horario de la reserva.'}
          </p>
        )}
        {asistenciaError && <p role="alert" className="text-sm text-red-600">{asistenciaError}</p>}
      </section>
      {!esTitular && (
        <button onClick={abandonar} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
          Abandonar cubículo
        </button>
      )}
      {esTitular && (
        <div>
          <button
            onClick={() => setCancelando(true)}
            disabled={!puedeCancelar(reserva) && !tieneProteccion}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Cancelar reserva
          </button>
          {!puedeCancelar(reserva) && (
            <p className="mt-1 text-xs text-slate-500">
              {tieneProteccion
                ? 'Tu protección de cancelación tardía se usará al cancelar.'
                : `Solo se puede cancelar hasta ${CANCELAR_ANTES_MIN} minutos antes de que empiece.`}
            </p>
          )}
        </div>
      )}
      {errorGlobal && <p className="text-sm text-red-600">{errorGlobal}</p>}
      {cancelando && (
        <CancelDialog reserva={reserva} correo={correo} onClose={() => setCancelando(false)} onCancelled={onChanged} onError={setErrorGlobal} />
      )}
    </div>
  )
}
