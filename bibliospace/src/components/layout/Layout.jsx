import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const link = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`

function CorreoInput() {
  const { correo, setCorreo } = useAuth()
  const [valor, setValor] = useState(correo)
  const [error, setError] = useState('')

  const guardar = (e) => {
    e.preventDefault()
    setError(setCorreo(valor) || '')
  }

  return (
    <form onSubmit={guardar} className="flex w-full flex-col sm:w-auto">
      <div className="flex gap-1">
        <input
          type="email"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="tu@correo.unimet.edu.ve"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-56"
        />
        <button className="rounded-md bg-slate-200 px-3 text-sm hover:bg-slate-300">Guardar</button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}

export default function Layout() {
  const { rol } = useAuth()
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 text-lg font-bold text-indigo-700">BiblioSpace</span>
          <nav className="flex flex-1 flex-wrap gap-1">
            <NavLink to="/" end className={link}>Mapa</NavLink>
            <NavLink to="/mi-reserva" className={link}>Mi reserva</NavLink>
            <NavLink to="/historial" className={link}>Historial</NavLink>
            {rol === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
          </nav>
          <CorreoInput />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
