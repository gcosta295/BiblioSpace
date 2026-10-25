import { useState } from 'react'
import { bloquearCubiculo } from '../../api/sheets'

import lockIcon from '../../assets/admin/table-lock.svg'
import greenKeyIcon from '../../assets/admin/table-key-green.svg'

export default function BlockToggle({ cub, correo, onChanged, onError, compact = false, icon = lockIcon }) {
  const bloqueado = cub.Estado === 'Bloqueado'
  const [pidiendo, setPidiendo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const ejecutar = async (bloquear) => {
    setEnviando(true)
    const res = await bloquearCubiculo(correo, cub.Piso, cub.ID_Cubiculo, bloquear, motivo.trim())
    setEnviando(false)
    if (res.status === 'ok') {
      setPidiendo(false)
      setMotivo('')
      onChanged(`Cubículo ${cub.ID_Cubiculo} (piso ${cub.Piso}) ${bloquear ? 'bloqueado' : 'desbloqueado'}.`)
    } else onError(res.mensaje || 'No se pudo actualizar.')
  }

  if (bloqueado) {
    return (
      <button
        type="button"
        disabled={enviando}
        onClick={() => ejecutar(false)}
        aria-label="Desbloquear cubículo"
        title="Desbloquear cubículo"
        className={compact ? 'admin-icon-action' : 'rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50'}
      >
        {compact ? <img src={greenKeyIcon} alt="" /> : 'Desbloquear'}
      </button>
    )
  }
  if (!pidiendo) {
    return (
      <button
        type="button"
        onClick={() => setPidiendo(true)}
        aria-label="Bloquear cubículo"
        title="Bloquear cubículo"
        className={compact ? 'admin-icon-action' : 'rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50'}
      >
        {compact ? <img src={icon} alt="" /> : 'Bloquear'}
      </button>
    )
  }
  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      <input
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo (mantenimiento…)"
        className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button type="button" disabled={enviando} onClick={() => ejecutar(true)} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
        {enviando ? '…' : 'Confirmar'}
      </button>
      <button type="button" onClick={() => setPidiendo(false)} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100">
        Volver
      </button>
    </div>
  )
}
