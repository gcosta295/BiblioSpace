import { useCallback, useEffect, useState } from 'react'
import { listarAlumnosModeracion, suspenderAlumno } from '../../api/library'

const fechaLocal = (fecha) => new Date(fecha).toLocaleString('es-VE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export default function StudentModeration({ correo }) {
  const [alumnos, setAlumnos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [dias, setDias] = useState('1')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const resultado = await listarAlumnosModeracion(correo)
    if (resultado.status !== 'ok') {
      setError(resultado.mensaje || 'No se pudo cargar la lista de alumnos.')
      setCargando(false)
      return
    }
    setAlumnos(Array.isArray(resultado.valor) ? resultado.valor : [])
    setError('')
    setCargando(false)
  }, [correo])

  useEffect(() => {
    const timer = window.setTimeout(cargar, 0)
    return () => window.clearTimeout(timer)
  }, [cargar])

  const cambiarSeleccion = (email) => {
    setSeleccionado((actual) => actual === email ? '' : email)
    setMotivo('')
    setDias('1')
    setError('')
    setAviso('')
  }

  const guardar = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setError('')
    setAviso('')
    const resultado = await suspenderAlumno(correo, seleccionado, motivo.trim(), Number(dias))
    setGuardando(false)
    if (resultado.status !== 'ok') {
      setError(resultado.mensaje || 'No se pudo suspender al alumno.')
      return
    }
    const alumno = alumnos.find((item) => item.correo === seleccionado)
    setAviso(`${alumno?.nombre || seleccionado} quedó suspendido hasta ${fechaLocal(resultado.suspendido_hasta)}.`)
    setSeleccionado('')
    setMotivo('')
    await cargar()
  }

  const filtro = busqueda.trim().toLocaleLowerCase()
  const visibles = alumnos.filter((alumno) =>
    [alumno.nombre, alumno.correo, alumno.carnet].some((valor) =>
      String(valor || '').toLocaleLowerCase().includes(filtro),
    ),
  )

  return (
    <section className="admin-panel admin-student-moderation" id="moderacion" aria-labelledby="student-moderation-heading">
      <div className="admin-panel-heading">
        <div>
          <h2 id="student-moderation-heading">Moderación de alumnos</h2>
          <p>Consulta las infracciones y suspende los derechos de reserva con una justificación y duración.</p>
        </div>
        <label className="admin-moderation-search">
          <span className="sr-only">Buscar alumnos</span>
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre, correo o carnet"
          />
        </label>
      </div>

      {error && <p className="admin-reward-message error" role="alert">{error}</p>}
      {aviso && <p className="admin-reward-message success" role="status">{aviso}</p>}

      {cargando ? <p className="admin-moderation-empty">Cargando alumnos…</p> : (
        <div className="admin-reward-table-scroll">
          <table className="admin-moderation-table">
            <thead>
              <tr><th>Alumno</th><th>Carnet</th><th>Infracciones</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {visibles.map((alumno) => {
                const suspendido = alumno.suspendido_hasta && new Date(alumno.suspendido_hasta) > new Date()
                return (
                  <tr key={alumno.correo}>
                    <td><strong>{alumno.nombre || 'Sin nombre'}</strong><small>{alumno.correo}</small></td>
                    <td>{alumno.carnet || '—'}</td>
                    <td>{alumno.total_suspensiones}</td>
                    <td>
                      {suspendido
                        ? <span className="admin-moderation-status active">Suspendido hasta {fechaLocal(alumno.suspendido_hasta)}</span>
                        : <span className="admin-moderation-status">Activo</span>}
                      {suspendido && <small>{alumno.motivo_suspension}</small>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-moderation-button"
                        aria-expanded={seleccionado === alumno.correo}
                        onClick={() => cambiarSeleccion(alumno.correo)}
                      >
                        {suspendido ? 'Extender suspensión' : 'Suspender'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!visibles.length && (
                <tr><td className="admin-moderation-empty" colSpan="5">
                  {alumnos.length ? 'No hay alumnos que coincidan con la búsqueda.' : 'No hay alumnos registrados.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {seleccionado && (
        <form className="admin-moderation-form" onSubmit={guardar}>
          <h3>Suspender a {seleccionado}</h3>
          <label>
            <span>Justificación</span>
            <textarea
              required
              maxLength={500}
              rows={3}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Describe la infracción observada."
            />
          </label>
          <label>
            <span>Duración (días, de 1 a 365)</span>
            <input
              required
              type="number"
              min="1"
              max="365"
              step="1"
              value={dias}
              onChange={(event) => setDias(event.target.value)}
            />
          </label>
          <div className="admin-moderation-actions">
            <button type="button" onClick={() => cambiarSeleccion('')}>Cancelar</button>
            <button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Confirmar suspensión'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
