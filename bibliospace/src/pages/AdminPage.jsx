import { useState } from 'react'
import CubicleForm from '../components/admin/CubicleForm'
import CubicleList from '../components/admin/CubicleList'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../hooks/useLibrary'

export default function AdminPage() {
  const { correo } = useAuth()
  const { cubiculos, reservas, cargando, error, recargar } = useLibrary()
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'error', texto }

  const ok = (texto) => {
    setAviso({ tipo: 'ok', texto })
    recargar()
  }
  const fallo = (texto) => setAviso({ tipo: 'error', texto })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Panel de administración</h1>
      {aviso && (
        <p className={`rounded-md p-3 text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-700'}`}>
          {aviso.texto}
        </p>
      )}
      <CubicleForm cubiculos={cubiculos} correo={correo} onChanged={ok} onError={fallo} />
      {cargando && !cubiculos.length && <p className="text-slate-500">Cargando…</p>}
      {error && !cargando && <p className="text-red-600">No se pudieron cargar los cubículos.</p>}
      {!error && cubiculos.length > 0 && (
        <CubicleList cubiculos={cubiculos} reservas={reservas} correo={correo} onChanged={ok} onError={fallo} />
      )}
    </div>
  )
}
