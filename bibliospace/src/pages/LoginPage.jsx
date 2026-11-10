import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import { ArrowIcon, CapIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon, ShieldIcon, UserIcon } from '../components/auth/AuthIcons'
import { useAuth } from '../context/AuthContext'
import { validarCorreoInstitucional } from '../services/reservationRules'

const PESTANAS = {
  usuario: {
    etiqueta: 'Estudiante / Usuario',
    Icono: UserIcon,
    InfoIcono: CapIcon,
    titulo: 'Acceso a Estudiantes y Comunidad Unimet',
    texto: 'Ingresa con tu correo institucional para reservar salas de estudio y cubículos.',
    ejemplo: 'usuario@correo.unimet.edu.ve',
  },
  admin: {
    etiqueta: 'Administrador',
    Icono: ShieldIcon,
    InfoIcono: ShieldIcon,
    titulo: 'Panel de Control y Biblioteca Admin',
    texto: 'Gestión de reservas, aprobación de solicitudes y control de inventario de cubículos.',
    ejemplo: 'admin@correo.unimet.edu.ve',
  },
}

export default function LoginPage() {
  const { correo: correoSesion, rol, perfilCargando, iniciarSesion } = useAuth()
  const { state } = useLocation()
  const [pestana, setPestana] = useState('usuario')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const esAdmin = pestana === 'admin'
  const actual = PESTANAS[pestana]
  const origen = state?.from?.pathname ?? '/'

  // Con sesión iniciada no se muestra el formulario. Mientras se valida el acceso (enviando) se espera,
  // para no entrar un instante con una cuenta que luego se rechaza.
  if (correoSesion && !perfilCargando && !enviando) {
    return <Navigate to={esAdmin && rol === 'admin' ? '/admin' : origen} replace />
  }

  const cambiarPestana = (nueva) => {
    setPestana(nueva)
    setError('')
    setAviso('')
  }

  const enviar = async (e) => {
    e.preventDefault()
    setAviso('')
    const problema = validarCorreoInstitucional(correo) || (clave ? null : 'Escribe tu contraseña.')
    if (problema) return setError(problema)
    setError('')
    setEnviando(true)
    const res = await iniciarSesion({ correo, clave, recordar, comoAdmin: esAdmin })
    setEnviando(false)
    if (res.status !== 'ok') setError(res.mensaje)
  }

  return (
    <section className="auth-page">
      <AuthBrand />

      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Tipo de acceso">
          {Object.entries(PESTANAS).map(([clavePestana, { etiqueta, Icono }]) => (
            <button
              key={clavePestana}
              type="button"
              role="tab"
              aria-selected={pestana === clavePestana}
              className={`auth-tab auth-tab-${clavePestana}${pestana === clavePestana ? ' is-active' : ''}`}
              onClick={() => cambiarPestana(clavePestana)}
            >
              <Icono />
              {etiqueta}
            </button>
          ))}
        </div>

        <div className={`auth-info${esAdmin ? ' is-admin' : ''}`}>
          <actual.InfoIcono />
          <p>
            <strong>{actual.titulo}</strong>
            <span>{actual.texto}</span>
          </p>
        </div>

        <form onSubmit={enviar} noValidate>
          <label className="auth-field">
            <span className="auth-field-head">Correo Institucional</span>
            <span className="auth-input-wrap">
              <MailIcon className="auth-icon" />
              <input
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder={actual.ejemplo}
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-field-head">
              Contraseña
              <button
                type="button"
                className="auth-forgot"
                onClick={() => setAviso('La recuperación de contraseña aún no está disponible. Contacta a la biblioteca.')}
              >
                ¿Olvidaste la clave?
              </button>
            </span>
            <span className="auth-input-wrap">
              <LockIcon className="auth-icon" />
              <input
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••••••"
              />
              <button
                type="button"
                className="auth-eye"
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVerClave((v) => !v)}
              >
                {verClave ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>

          <label className="auth-check">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
            Mantener sesión iniciada en este dispositivo
          </label>

          {aviso && <p className="auth-note" role="status">{aviso}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" className={`auth-submit${esAdmin ? ' is-admin' : ''}`} disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar al sistema'}
            {!enviando && <ArrowIcon />}
          </button>
        </form>

        <p className="auth-switch">
          ¿Nuevo en la biblioteca? <Link to="/registro">Solicitar acceso institucional</Link>
        </p>
      </div>
    </section>
  )
}
