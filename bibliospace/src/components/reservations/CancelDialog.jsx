import { useState } from 'react'
import { cancelarReserva } from '../../api/sheets'

export default function CancelDialog({ reserva, correo, onClose, onCancelled, onError }) {
  const [enviando, setEnviando] = useState(false)

  const confirmar = async () => {
    setEnviando(true)
    const res = await cancelarReserva(correo, reserva.ID_Reserva)
    setEnviando(false)
    if (res.status === 'ok') onCancelled('Reserva cancelada.')
    else {
      onError(res.mensaje || 'No se pudo cancelar.')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold">¿Cancelar la reserva?</h2>
        <p className="text-sm text-slate-600">
          El cubículo {reserva.ID_Cubiculo} (piso {reserva.Piso}) quedará libre para otros estudiantes.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">Volver</button>
          <button
            onClick={confirmar} disabled={enviando}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {enviando ? 'Cancelando…' : 'Sí, cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}
