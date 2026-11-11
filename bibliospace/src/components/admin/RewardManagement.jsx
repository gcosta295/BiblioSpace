import { useCallback, useEffect, useState } from 'react'
import {
  guardarRecompensa,
  obtenerCatalogoAdmin,
  obtenerReporteRecompensas,
} from '../../api/library'

const TIPOS_RECOMPENSA = [
  ['VENTANA_ANTICIPADA', 'Ventana extendida'],
  ['PASE_EXPRESS', 'Pase Express'],
  ['FAVORITO', 'Cubículo favorito'],
  ['CANCELACION_TARDIA', 'Cancelación tardía'],
]

const NUEVA_RECOMPENSA = {
  id: '',
  tipo: 'VENTANA_ANTICIPADA',
  nombre: '',
  descripcion: '',
  costo_horas: '',
  stock: '',
  activo: true,
}

export default function RewardManagement({ correo }) {
  const [catalogo, setCatalogo] = useState([])
  const [reporte, setReporte] = useState({ mas_canjeadas: [], mas_horas: [] })
  const [recompensa, setRecompensa] = useState(NUEVA_RECOMPENSA)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const [catalogoRes, reporteRes] = await Promise.all([
      obtenerCatalogoAdmin(correo),
      obtenerReporteRecompensas(correo),
    ])
    if (catalogoRes.status !== 'ok' || reporteRes.status !== 'ok') {
      setError(catalogoRes.mensaje || reporteRes.mensaje || 'No se pudo cargar el catálogo o el reporte.')
      setCargando(false)
      return
    }
    setCatalogo(Array.isArray(catalogoRes.recompensas) ? catalogoRes.recompensas : [])
    setReporte({
      mas_canjeadas: Array.isArray(reporteRes.mas_canjeadas) ? reporteRes.mas_canjeadas : [],
      mas_horas: Array.isArray(reporteRes.mas_horas) ? reporteRes.mas_horas : [],
    })
    setError('')
    setCargando(false)
  }, [correo])

  useEffect(() => {
    const timer = window.setTimeout(cargar, 0)
    return () => window.clearTimeout(timer)
  }, [cargar])

  const editar = (item) => {
    setRecompensa({
      ...item,
      costo_horas: String(item.costo_horas),
      stock: item.stock === null ? '' : String(item.stock),
    })
    setAviso('')
    setError('')
  }

  const guardar = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setError('')
    const res = await guardarRecompensa(correo, {
      ...recompensa,
      costo_horas: Number(recompensa.costo_horas),
      stock: recompensa.stock === '' ? null : Number(recompensa.stock),
    })
    setGuardando(false)
    if (res.status !== 'ok') {
      setError(res.mensaje || 'No se pudo guardar la recompensa.')
      return
    }
    setRecompensa(NUEVA_RECOMPENSA)
    setAviso('Catálogo actualizado.')
    await cargar()
  }

  const cambiarActivo = async (item) => {
    const res = await guardarRecompensa(correo, { ...item, activo: !item.activo })
    if (res.status !== 'ok') {
      setError(res.mensaje || 'No se pudo actualizar la disponibilidad.')
      return
    }
    setAviso(item.activo ? 'Recompensa archivada.' : 'Recompensa activada.')
    await cargar()
  }

  return (
    <section className="admin-panel admin-rewards-management" id="recompensas" aria-labelledby="admin-rewards-heading">
      <div className="admin-panel-heading">
        <div>
          <h2 id="admin-rewards-heading">Catálogo y métricas de recompensas</h2>
          <p>Define el costo, disponibilidad y stock; consulta los canjes y las horas acumuladas.</p>
        </div>
      </div>
      {error && <p className="admin-reward-message error" role="alert">{error}</p>}
      {aviso && <p className="admin-reward-message success" role="status">{aviso}</p>}

      <div className="admin-reward-report-grid">
        <section>
          <h3>Recompensas más canjeadas</h3>
          {reporte.mas_canjeadas.length ? (
            <ol>
              {reporte.mas_canjeadas.slice(0, 5).map((item) => (
                <li key={item.nombre}><span>{item.nombre}</span><strong>{item.canjes}</strong></li>
              ))}
            </ol>
          ) : <p>Aún no hay canjes registrados.</p>}
        </section>
        <section>
          <h3>Usuarios con más horas acumuladas</h3>
          {reporte.mas_horas.length ? (
            <ol>
              {reporte.mas_horas.map((item) => (
                <li key={item.correo}>
                  <span>{item.nombre}<small>{item.correo}</small></span>
                  <strong>{Number(item.horas).toFixed(2)} h</strong>
                </li>
              ))}
            </ol>
          ) : <p>Aún no hay horas acreditadas.</p>}
        </section>
      </div>

      <div className="admin-reward-catalog">
        <div>
          <h3>Administrar premios</h3>
          {cargando ? <p>Cargando catálogo…</p> : catalogo.length ? (
            <div className="admin-reward-table-scroll">
              <table>
                <thead>
                  <tr><th>Recompensa</th><th>Costo</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {catalogo.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.nombre}</strong><small>{item.descripcion}</small></td>
                      <td>{item.costo_horas} h</td>
                      <td>{item.stock === null ? 'Ilimitado' : item.stock}</td>
                      <td>{item.activo ? 'Activa' : 'Archivada'}</td>
                      <td className="admin-reward-row-actions">
                        <button type="button" onClick={() => editar(item)}>Editar</button>
                        <button type="button" onClick={() => cambiarActivo(item)}>{item.activo ? 'Archivar' : 'Activar'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No hay recompensas registradas.</p>}
        </div>

        <form className="admin-reward-form" onSubmit={guardar}>
          <h3>{recompensa.id ? 'Editar recompensa' : 'Agregar recompensa'}</h3>
          <label>
            <span>Tipo de beneficio</span>
            <select value={recompensa.tipo} onChange={(event) => setRecompensa({ ...recompensa, tipo: event.target.value })}>
              {TIPOS_RECOMPENSA.map(([tipo, nombre]) => <option value={tipo} key={tipo}>{nombre}</option>)}
            </select>
          </label>
          <label>
            <span>Nombre</span>
            <input required maxLength={120} value={recompensa.nombre} onChange={(event) => setRecompensa({ ...recompensa, nombre: event.target.value })} />
          </label>
          <label>
            <span>Descripción</span>
            <textarea rows="3" value={recompensa.descripcion} onChange={(event) => setRecompensa({ ...recompensa, descripcion: event.target.value })} />
          </label>
          <div className="admin-reward-form-row">
            <label>
              <span>Costo (horas)</span>
              <input required type="number" min="0.01" step="0.01" value={recompensa.costo_horas} onChange={(event) => setRecompensa({ ...recompensa, costo_horas: event.target.value })} />
            </label>
            <label>
              <span>Stock (vacío = ilimitado)</span>
              <input type="number" min="0" step="1" value={recompensa.stock} onChange={(event) => setRecompensa({ ...recompensa, stock: event.target.value })} />
            </label>
          </div>
          <label className="admin-reward-active-toggle">
            <input type="checkbox" checked={recompensa.activo} onChange={(event) => setRecompensa({ ...recompensa, activo: event.target.checked })} />
            <span>Disponible para canje</span>
          </label>
          <div className="admin-reward-form-actions">
            {recompensa.id && <button type="button" onClick={() => setRecompensa(NUEVA_RECOMPENSA)}>Cancelar edición</button>}
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar recompensa'}</button>
          </div>
        </form>
      </div>
    </section>
  )
}
