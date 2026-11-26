import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { comprobarFotoPerfil, telefonoParaGuardar, telefonoParaMostrar, validarDatosPerfil } from '../utils/perfil'
import './PerfilPage.css'

function FormularioPerfil({ usernameInicial, telefonoInicial, guardarDatosPerfil }) {
  const [username, setUsername] = useState(usernameInicial)
  const [telefono, setTelefono] = useState(() => telefonoParaMostrar(telefonoInicial))
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState({ texto: '', error: false })
  const camposVacios = !username.trim() && !telefono.trim()

  const guardar = async (evento) => {
    evento.preventDefault()
    if (camposVacios) return
    const cambios = { username: username.trim(), telefono: telefono.trim() }
    const error = validarDatosPerfil(cambios.username, cambios.telefono)
    if (error) {
      setAviso({ texto: error, error: true })
      return
    }
    setGuardando(true)
    setAviso({ texto: '', error: false })
    try {
      const resultado = await guardarDatosPerfil({ ...cambios, telefono: telefonoParaGuardar(cambios.telefono) })
      if (resultado.status === 'ok') {
        setUsername(resultado.username)
        setTelefono(telefonoParaMostrar(resultado.telefono))
        setAviso({ texto: 'Perfil actualizado.', error: false })
      } else {
        setAviso({ texto: resultado.mensaje || 'No se pudo guardar el perfil.', error: true })
      }
    } catch {
      setAviso({ texto: 'No se pudo guardar el perfil. Intenta de nuevo.', error: true })
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
          <input type="tel" autoComplete="tel-national" inputMode="numeric" value={telefono} placeholder="04248856911"
            onChange={(e) => setTelefono(e.target.value)} disabled={guardando} />
        </span>
      </label>
      <button className="perfil-accion" disabled={guardando || camposVacios} aria-busy={guardando}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {aviso.texto && (
        <p className={aviso.error ? 'auth-error' : undefined} role={aviso.error ? 'alert' : 'status'}>
          {aviso.texto}
        </p>
      )}
    </form>
  )
}

export default function PerfilPage() {
  const { correo, username, telefono, fotoPerfil, perfilCargando, guardarDatosPerfil, guardarFotoPerfil } = useAuth()
  const [subiendo, setSubiendo] = useState(false)
  const [avisoFoto, setAvisoFoto] = useState({ texto: '', error: false })

  const cambiarFoto = async (evento) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setSubiendo(true)
    setAvisoFoto({ texto: '', error: false })
    try {
      const { tipo, error } = await comprobarFotoPerfil(archivo)
      if (error) {
        setAvisoFoto({ texto: error, error: true })
        return
      }
      const resultado = await guardarFotoPerfil(archivo, tipo)
      if (resultado.status === 'ok') {
        setAvisoFoto({ texto: 'Foto actualizada.', error: false })
      } else {
        setAvisoFoto({ texto: resultado.mensaje || 'No se pudo cargar la foto.', error: true })
      }
    } catch {
      setAvisoFoto({ texto: 'No se pudo cargar la foto. Intenta de nuevo.', error: true })
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
            {avisoFoto.texto && (
              <p className={avisoFoto.error ? 'auth-error' : undefined} role={avisoFoto.error ? 'alert' : 'status'}>
                {avisoFoto.texto}
              </p>
            )}
          </div>
        </div>
        <FormularioPerfil key={correo} usernameInicial={username} telefonoInicial={telefono}
          guardarDatosPerfil={guardarDatosPerfil} />
      </div>
    </section>
  )
}
