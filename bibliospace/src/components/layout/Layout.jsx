import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

import { UserIcon } from '../auth/AuthIcons'
import logoHeader from '../../assets/logo-header.png'
import logoFooter from '../../assets/logo-footer.png'
import notificationsIcon from '../../assets/notifications.png'

function PerfilMenu() {
  const { correo, nombre, rol, cerrarSesion } = useAuth()
  const [abierto, setAbierto] = useState(false)

  if (!correo) {
    return (
      <div className="profile" id="profile">
        <Link to="/login" className="profile-login">
          <UserIcon width={16} height={16} />
          Iniciar sesión
        </Link>
      </div>
    )
  }

  const visible = nombre || correo.split('@')[0]
  const iniciales = visible.split(' ').filter(Boolean).map((parte) => parte[0]).slice(0, 2).join('').toUpperCase()

  const salir = async () => {
    setAbierto(false)
    await cerrarSesion()
  }

  return (
    <div className="profile" id="profile">
      <img className="notification-icon" src={notificationsIcon} alt="" aria-hidden="true" />
      <div className="profile-divider" />
      <button type="button" className="profile-button" aria-expanded={abierto} onClick={() => setAbierto((actual) => !actual)}>
        <span className="profile-copy">
          <strong>{visible}</strong>
          <span>{rol === 'admin' ? 'Administrador' : 'Estudiante'}</span>
        </span>
        <span className="profile-avatar" aria-hidden="true">{iniciales}</span>
      </button>
      {abierto && (
        <div className="profile-form profile-menu">
          <span className="profile-menu-correo">{correo}</span>
          <button type="button" onClick={salir}>Cerrar sesión</button>
        </div>
      )}
    </div>
  )
}

const link = ({ isActive }) => `site-nav-link${isActive ? ' is-active' : ''}`

export default function Layout() {
  const { correo, rol } = useAuth()
  const { pathname } = useLocation()
  const adminDashboard = rol === 'admin' && pathname === '/admin'

  return (
    <div className={`site-shell${adminDashboard ? ' admin-shell' : ''}`}>
      {!adminDashboard && <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/" end className="brand-link" aria-label="BiblioSpace, inicio">
            <img src={logoHeader} alt="BiblioSpace — Biblioteca Universidad Metropolitana" />
          </NavLink>
          <nav className={`site-nav${correo ? '' : ' site-nav-guest'}`} aria-label="Navegación principal">
            <NavLink to="/" end className={link}>Inicio</NavLink>
            {correo && <NavLink to="/mi-reserva" className={link}>Mis Reservas</NavLink>}
            {correo && <NavLink to="/historial" className={link}>Historial</NavLink>}
            {rol === 'admin' && <NavLink to="/admin" className={link}>Administración</NavLink>}
          </nav>
          <PerfilMenu />
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
          <p className="footer-copyright">© 2026 BiblioSpace · Universidad Metropolitana · Todos los derechos reservados.</p>
        </div>
      </footer>}
    </div>
  )
}
