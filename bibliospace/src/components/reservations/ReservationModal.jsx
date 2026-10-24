import { useState } from 'react'
import { crearReserva } from '../../api/library'
import { useAuth } from '../../context/AuthContext'
import { capacidadDe, CIERRE, validarInvitado, validarReserva } from '../../services/reservationRules'
import { conocidos, horaTexto } from '../../utils/time'
import MemberPicker from './MemberPicker'

const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm'

export default function ReservationModal({ cub, reservas, fecha, hora, onClose, onCreated }) {
  const { correo } = useAuth()
  const [nombre, setNombre] = useState('')
  const [carnet, setCarnet] = useState('')
  const [duracion, setDuracion] = useState(1)
  const [miembros, setMiembros] = useState([])
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const agregar = (m) => {
    const err = validarInvitado({ reservas, correo: m, actuales: [correo, ...miembros], cub })
    if (!err) setMiembros((l) => [...l, m])
    return err
  }

  const quitar = (m) => {
    setMiembros((l) => l.filter((x) => x !== m))
    return null
  }

  const enviar = async (e) => {
    e.preventDefault()
    const err = validarReserva({ reservas, cub, correo, miembros, fecha, hora, duracion })
    if (err) return setError(err)
    setEnviando(true)
    const res = await crearReserva({
      correo, nombre, carnet, fecha, duracion, miembros,
      piso: cub.Piso, cubiculoId: cub.ID_Cubiculo, horaInicio: horaTexto(hora),
    })
    setEnviando(false)
    if (res.status === 'ok') onCreated(`Reserva confirmada: ${res.franja}`)
    else setError(res.mensaje || 'No se pudo crear la reserva.')
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <h2 className="text-lg font-semibold">
          Reservar cubículo {cub.ID_Cubiculo} · Piso {cub.Piso}
        </h2>
        <p className="text-sm text-slate-500">
          {fecha} desde las {horaTexto(hora)}
        </p>
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" className={field} />
        <input required value={carnet} onChange={(e) => setCarnet(e.target.value)} placeholder="Número de carnet" className={field} />
        <label className="block text-sm">
          <span className="block text-slate-500">Duración</span>
          <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className={field}>
            <option value={1}>1 hora</option>
            {hora + 2 <= CIERRE && <option value={2}>2 horas</option>}
          </select>
        </label>
        <div>
          <p className="mb-1 text-sm text-slate-500">
            Integrantes ({1 + miembros.length}/{capacidadDe(cub)}) · mínimo 2
          </p>
          <MemberPicker
            titular={correo || 'Guarda tu correo arriba a la derecha'}
            miembros={miembros}
            sugerencias={conocidos(reservas)}
            onAdd={agregar}
            onRemove={quitar}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">
            Cancelar
          </button>
          <button disabled={enviando} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {enviando ? 'Reservando…' : 'Reservar'}
          </button>
        </div>
      </form>
    </div>
  )
}
