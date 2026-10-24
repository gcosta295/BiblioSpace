import { useState } from 'react'
import { crearCubiculo } from '../../api/library'

const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm'

export default function CubicleForm({ cubiculos, correo, onChanged, onError }) {
  const pisoInicial = Math.max(1, ...cubiculos.map((c) => Number(c.Piso)))
  const [piso, setPiso] = useState(pisoInicial)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    const res = await crearCubiculo(correo, piso)
    setEnviando(false)
    if (res.status === 'ok') onChanged(`Cubículo ${res.id} creado en el piso ${piso}.`)
    else onError(res.mensaje || 'No se pudo crear el cubículo.')
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="w-full text-sm font-semibold">Nuevo cubículo</h2>
      <label className="text-sm">
        <span className="block text-slate-500">Piso</span>
        <input type="number" min={1} required value={piso} onChange={(e) => setPiso(Number(e.target.value))} className={`${field} w-24`} />
      </label>
      <button disabled={enviando} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
        {enviando ? 'Creando…' : 'Crear cubículo'}
      </button>
    </form>
  )
}
