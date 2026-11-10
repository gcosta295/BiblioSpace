import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthBrand from '../components/auth/AuthBrand'
import { ArrowIcon, CapIcon, EyeIcon, EyeOffIcon, IdIcon, LockIcon, MailIcon, UserIcon } from '../components/auth/AuthIcons'
import { useAuth } from '../context/AuthContext'
import { validarCarnet, validarClave, validarCorreoInstitucional, validarNombre } from '../services/reservationRules'

export default function RegisterPage() {
  const { correo: correoSesion, perfilCargando, registrar } = useAuth()
  const [nombre, setNombre] = useState('')
  const [carnet, setCarnet] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  if (correoSesion && !perfilCargando && !enviando) return <Navigate to="/" replace />

  const enviar = async (e) => {
    e.preventDefault()
    const problema =
      validarNombre(nombre) ||
      validarCarnet(carnet) ||
      validarCorreoInstitucional(correo) ||
      validarClave(clave) ||
      (clave === repetir ? null : 'Las contraseñas no coinciden.')
    if (problema) return setError(problema)
    setError('')
    setEnviando(true)
    const res = await registrar({ nombre: nombre.trim(), carnet: carnet.trim(), correo, clave })
    setEnviando(false)
    if (res.status !== 'ok') setError(res.mensaje)
    else setConfirmar(Boolean(res.confirmar))
  }

  return (
    <section className="auth-page">
      <AuthBrand />

      <div className="auth-card">
        <div className="auth-info">
          <CapIcon />
          <p>
            <strong>Solicitud de acceso institucional</strong>
            <span>Regístrate con tu correo institucional para reservar cubículos. Tus datos quedan guardados y tu sesión se mantiene.</span>
          </p>
        </div>

        <form onSubmit={enviar} noValidate>
          <label className="auth-field">
            <span className="auth-field-head">Nombre completo</span>
            <span className="auth-input-wrap">
              <UserIcon className="auth-icon" />
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, ''))}
                maxLength={100}
                autoComplete="name"
                placeholder="Solo letras y espacios"
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-field-head">Carnet</span>
            <span className="auth-input-wrap">
              <IdIcon className="auth-icon" />
              <input
                value={carnet}
                onChange={(e) => setCarnet(e.target.value.replace(/\D/g, '').slice(0, 11))}
                inputMode="numeric"
                maxLength={11}
                placeholder="11 dígitos"
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-field-head">Correo Institucional</span>
            <span className="auth-input-wrap">
              <MailIcon className="auth-icon" />
              <input
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="usuario@correo.unimet.edu.ve"
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-field-head">Contraseña</span>
            <span className="auth-input-wrap">
              <LockIcon className="auth-icon" />
              <input
                type={verClave ? 'text' : 'password'}
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Mínimo 8 caracteres"
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

          <label className="auth-field">
            <span className="auth-field-head">Confirmar contraseña</span>
            <span className="auth-input-wrap">
              <LockIcon className="auth-icon" />
              <input
                type={verClave ? 'text' : 'password'}
                autoComplete="new-password"
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </span>
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}
          {confirmar && (
            <p className="auth-note" role="status">
              Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego <Link to="/login">inicia sesión</Link>.
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={enviando}>
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
            {!enviando && <ArrowIcon />}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </section>
  )
}
