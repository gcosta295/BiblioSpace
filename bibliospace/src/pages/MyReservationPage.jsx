import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReservationCard from '../components/reservations/ReservationCard'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../hooks/useLibrary'
import { reservaVigente } from '../utils/time'

export default function MyReservationPage() {
  const { correo } = useAuth()
  const { cubiculos, reservas, cargando, error, recargar } = useLibrary()
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'error', texto }

  if (!correo) return <p className="text-slate-600">Guarda tu correo institucional (arriba a la derecha) para ver tu reserva.</p>
  if (cargando && !reservas.length) return <p className="text-slate-500">Cargando…</p>
  if (error) return <p className="text-red-600">No se pudo cargar la información.</p>

  const reserva = reservaVigente(reservas, correo)
  const cub = reserva && cubiculos.find((c) => Number(c.Piso) === Number(reserva.Piso) && Number(c.ID_Cubiculo) === Number(reserva.ID_Cubiculo))

  const ok = (texto) => {
    setAviso({ tipo: 'ok', texto })
    recargar()
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Mi reserva</h1>
      {aviso && (
        <p className={`rounded-md p-3 text-sm ${aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-700'}`}>
          {aviso.texto}
        </p>
      )}
      {reserva ? (
        <ReservationCard key={reserva.ID_Reserva + reserva.Miembros} reserva={reserva} cub={cub} reservas={reservas} correo={correo} onChanged={ok} />
      ) : (
        <p className="text-slate-600">
          No tienes una reserva activa. <Link to="/" className="text-indigo-600 underline">Ver el mapa</Link>
        </p>
      )}
    </div>
  )
}
