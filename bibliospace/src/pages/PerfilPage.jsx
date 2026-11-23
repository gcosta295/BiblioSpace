import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { comprobarFotoPerfil, validarDatosPerfil } from '../utils/perfil'
import './PerfilPage.css'

function FormularioPerfil({ usernameInicial, telefonoInicial, guardarDatosPerfil }) {
  const [username, setUsername] = useState(usernameInicial)
  const [telefono, setTelefono] = useState(telefonoInicial)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const guardar = async (evento) => {
    evento.preventDefault()
    const cambios = { username: username.trim(), telefono: telefono.trim() }
    const error = validarDatosPerfil(cambios.username, cambios.telefono)
    if (error) {
      setMensaje(error)
      return
    }
    setGuardando(true)
    setMensaje('')
    try {
      const resultado = await guardarDatosPerfil(cambios)
      if (resultado.status === 'ok') {
        setUsername(resultado.username)
        setTelefono(resultado.telefono)
      }
      setMensaje(resultado.status === 'ok' ? 'Perfil actualizado.' : resultado.mensaje)
    } catch {
      setMensaje('No se pudo guardar el perfil. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      <label className="auth-field">
        <span className="auth-field-head">Nombre de usuario</span>
        <span className="auth-input-wrap">
          <input value={username} onChange={(e) => setUsername(e.target.value)} disabled={guardando}
            aria-describedby="perfil-username-ayuda" />
        </span>
        <small id="perfil-username-ayuda">Hasta 12 caracteres.</small>
      </label>
      <label className="auth-field">
        <span className="auth-field-head">Número telefónico</span>
        <span className="auth-input-wrap">
          <input type="tel" autoComplete="tel" value={telefono} placeholder="+58-4242789290"
            onChange={(e) => setTelefono(e.target.value)} disabled={guardando} />
        </span>
      </label>
      <button className="perfil-accion" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {mensaje && <p role="status">{mensaje}</p>}
    </form>
  )
}

export default function PerfilPage() {
  const { correo, username, telefono, fotoPerfil, perfilCargando, guardarDatosPerfil, guardarFotoPerfil } = useAuth()
  const [subiendo, setSubiendo] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cambiarFoto = async (evento) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setSubiendo(true)
    setMensaje('')
    try {
      const { tipo, error } = await comprobarFotoPerfil(archivo)
      if (error) {
        setMensaje(error)
        return
      }
      const resultado = await guardarFotoPerfil(archivo, tipo)
      setMensaje(resultado.status === 'ok' ? 'Foto actualizada.' : resultado.mensaje)
    } catch {
      setMensaje('No se pudo guardar la foto. Intenta de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  if (perfilCargando) return <p className="admin-access-loading" role="status">Cargando perfil…</p>

  return (
    <section className="auth-page">
      <div className="auth-card perfil-editor">
        <h1>Mi perfil</h1>
        <div className="perfil-editor-foto">
          {fotoPerfil && <img src={fotoPerfil} alt="Tu foto de perfil" className="perfil-foto-vista" />}
          <div>
            <label className="auth-field">
              <span className="auth-field-head">Cambiar foto de perfil</span>
              <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={cambiarFoto} disabled={subiendo} aria-describedby="perfil-foto-ayuda" />
            </label>
            <small id="perfil-foto-ayuda">JPG, JPEG o PNG. Máximo 1 MB.</small>
            {subiendo && <p role="status">Subiendo foto…</p>}
            {mensaje && <p role="status">{mensaje}</p>}
          </div>
        </div>
        <FormularioPerfil key={correo} usernameInicial={username} telefonoInicial={telefono}
          guardarDatosPerfil={guardarDatosPerfil} />
      </div>
    </section>
  )
}
