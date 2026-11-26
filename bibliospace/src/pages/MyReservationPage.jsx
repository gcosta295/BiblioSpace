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

  if (!correo) return <p className="res-muted">Inicia sesión para ver tu reserva.</p>
  if (cargando && !reservas.length) return <p className="res-muted">Cargando…</p>
  if (error) return <p className="res-error">No se pudo cargar la información.</p>

  const reserva = reservaVigente(reservas, correo)
  const cub = reserva && cubiculos.find((c) => Number(c.Piso) === Number(reserva.Piso) && Number(c.ID_Cubiculo) === Number(reserva.ID_Cubiculo))

  const ok = (texto) => {
    setAviso({ tipo: 'ok', texto })
    recargar()
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="res-title text-xl font-semibold">Mi reserva</h1>
      {aviso && (
        <p className={`rounded-md p-3 text-sm ${aviso.tipo === 'ok' ? 'res-notice-ok' : 'res-notice-error'}`}>
          {aviso.texto}
        </p>
      )}
      {reserva ? (
        <ReservationCard key={reserva.ID_Reserva + reserva.Miembros} reserva={reserva} cub={cub} reservas={reservas} correo={correo} onChanged={ok} />
      ) : (
        <p className="res-muted">
          No tienes una reserva activa. <Link to="/" className="history-link underline">Ver el mapa</Link>
        </p>
      )}
    </div>
  )
}
