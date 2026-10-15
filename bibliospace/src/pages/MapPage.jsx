import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import CubicleMap from '../components/map/CubicleMap'
import Legend from '../components/map/Legend'
import ReservationModal from '../components/reservations/ReservationModal'
import { useLibrary } from '../hooks/useLibrary'
import { horaActual, horaTexto, hoyISO } from '../utils/time'

import { APERTURA, CIERRE } from '../services/reservationRules'

const HORAS = Array.from({ length: CIERRE - APERTURA }, (_, i) => APERTURA + i) // 7:00 a 16:00 (la última franja termina a las 17:00)
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm'

export default function MapPage() {
  const { rol } = useAuth()
  const { cubiculos, reservas, cargando, error, recargar } = useLibrary()
  const [piso, setPiso] = useState(1)
  const [fecha, setFecha] = useState(hoyISO)
  const [hora, setHora] = useState(() => Math.min(Math.max(horaActual(), APERTURA), CIERRE - 1))
  const [seleccionado, setSeleccionado] = useState(null)
  const [aviso, setAviso] = useState('')

  const pisos = [...new Set(cubiculos.map((c) => Number(c.Piso)))].sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-slate-500">Fecha</span>
          <input type="date" min={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} className={field} />
        </label>
        <label className="text-sm">
          <span className="block text-slate-500">Hora</span>
          <select value={hora} onChange={(e) => setHora(Number(e.target.value))} className={field}>
            {HORAS.map((h) => (
              <option key={h} value={h}>{horaTexto(h)}</option>
            ))}
          </select>
        </label>
        <button onClick={recargar} className="rounded-md bg-slate-200 px-3 py-1.5 text-sm hover:bg-slate-300">
          Actualizar
        </button>
      </div>

      <div className="flex gap-2">
        {pisos.map((p) => (
          <button
            key={p}
            onClick={() => setPiso(p)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              p === piso ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300'
            }`}
          >
            Piso {p}
          </button>
        ))}
      </div>

      <Legend />

      {cargando && <p className="text-slate-500">Cargando…</p>}
      {error && !cargando && <p className="text-red-600">No se pudieron cargar los cubículos.</p>}
      {!error && cubiculos.length > 0 && (
        <CubicleMap
          cubiculos={cubiculos}
          reservas={reservas}
          piso={piso}
          fecha={fecha}
          hora={hora}
          seleccionado={seleccionado}
          esAdmin={rol === 'admin'}
          onSelect={setSeleccionado}
        />
      )}

      {aviso && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">{aviso}</p>}

      {seleccionado && (
        <ReservationModal
          cub={seleccionado}
          reservas={reservas}
          fecha={fecha}
          hora={hora}
          onClose={() => setSeleccionado(null)}
          onCreated={(msg) => {
            setSeleccionado(null)
            setAviso(msg)
            recargar()
          }}
        />
      )}
    </div>
  )
}
