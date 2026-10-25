import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

import logoHeader from '../../assets/logo-header.png'
import logoFooter from '../../assets/logo-footer.png'
import notificationsIcon from '../../assets/notifications.png'

function CorreoInput() {
  const { correo, setCorreo } = useAuth()
  const [valor, setValor] = useState(correo)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)

  const guardar = (e) => {
    e.preventDefault()
    const mensaje = setCorreo(valor)
    setError(mensaje || '')
    if (!mensaje) setAbierto(false)
  }

  const nombre = correo
    ? correo
        .split('@')[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(' ')
    : 'Invitado'

  return (
    <div className="profile" id="profile">
      <img className="notification-icon" src={notificationsIcon} alt="" aria-hidden="true" />
      <div className="profile-divider" />
      <button
        type="button"
        className="profile-button"
        aria-expanded={abierto}
        onClick={() => {
          setValor(correo)
          setError('')
          setAbierto((actual) => !actual)
        }}
      >
        <span className="profile-copy">
          <strong>{nombre}</strong>
          <span>{correo ? 'Estudiante' : 'Guarda tu correo'}</span>
        </span>
        <span className="profile-avatar" aria-hidden="true">
          {nombre === 'Invitado' ? '?' : nombre.split(' ').map((parte) => parte[0]).slice(0, 2).join('')}
        </span>
      </button>
      {abierto && (
        <form onSubmit={guardar} className="profile-form">
          <label htmlFor="institutional-email">Correo institucional</label>
          <div className="profile-form-row">
            <input
              id="institutional-email"
              type="email"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="tu@correo.unimet.edu.ve"
            />
            <button type="submit">Guardar</button>
          </div>
          {error && <span className="profile-error">{error}</span>}
        </form>
      )}
    </div>
  )
}

const link = ({ isActive }) => `site-nav-link${isActive ? ' is-active' : ''}`

export default function Layout() {
  const { rol } = useAuth()
  const { pathname } = useLocation()
  const adminDashboard = rol === 'admin' && pathname === '/admin'

  return (
    <div className={`site-shell${adminDashboard ? ' admin-shell' : ''}`}>
      {!adminDashboard && <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" end className="brand-link" aria-label="BiblioSpace, inicio">
            <img src={logoHeader} alt="BiblioSpace — Biblioteca Universidad Metropolitana" />
          </NavLink>
          <nav className="site-nav" aria-label="Navegación principal">
            <NavLink to="/" end className={link}>Inicio</NavLink>
            <NavLink to="/mi-reserva" className={link}>Mis Reservas</NavLink>
            <NavLink to="/historial" className={link}>Historial</NavLink>
            {rol === 'admin' && <NavLink to="/admin" className={link}>Administración</NavLink>}
          </nav>
          <CorreoInput />
        </div>
      </header>}
      <main className="site-main">
        <Outlet />
      </main>
      {!adminDashboard && <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-description">
            <img src={logoFooter} alt="BiblioSpace" />
            <p>Sistema integral de gestión de espacios de estudio para la Universidad Metropolitana.</p>
          </div>
          <p className="footer-copyright">© 2023 BiblioSpace · Universidad Metropolitana · Todos los derechos reservados.</p>
        </div>
      </footer>}
    </div>
  )
}
