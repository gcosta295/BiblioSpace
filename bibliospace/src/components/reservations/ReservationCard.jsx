import { useState } from 'react'
import { abandonarReserva, agregarMiembro, quitarMiembro } from '../../api/library'
import { CANCELAR_ANTES_MIN, capacidadDe, MIN_PERSONAS, puedeCancelar, validarInvitado } from '../../services/reservationRules'
import { conocidos, miembrosDe } from '../../utils/time'
import CancelDialog from './CancelDialog'
import MemberPicker from './MemberPicker'

export default function ReservationCard({ reserva, cub, reservas, correo, onChanged }) {
  const [cancelando, setCancelando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const titular = String(reserva.Correo_Estudiante).toLowerCase()
  const miembros = miembrosDe(reserva)
  const esTitular = titular === correo

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
      {!esTitular && (
        <button onClick={abandonar} className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
          Abandonar cubículo
        </button>
      )}
      {esTitular && (
        <div>
          <button
            onClick={() => setCancelando(true)}
            disabled={!puedeCancelar(reserva)}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Cancelar reserva
          </button>
          {!puedeCancelar(reserva) && (
            <p className="mt-1 text-xs text-slate-500">Solo se puede cancelar hasta {CANCELAR_ANTES_MIN} minutos antes de que empiece.</p>
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
