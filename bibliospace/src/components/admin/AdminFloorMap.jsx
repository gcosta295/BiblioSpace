import { useMemo, useRef, useState } from 'react'
import { posicionesDelPiso, REFERENCIAS, tienePosicion } from '../../utils/plano'
import { aHoras } from '../../utils/time'
import './AdminFloorMap.css'

import keyIcon from '../../assets/admin/table-key.svg'
import lockIcon from '../../assets/admin/table-lock.svg'
import greenKeyIcon from '../../assets/admin/table-key-green.svg'

// HU (Sprint 3): "Como administrador quiero un diseño del mapa de cubículos ordenado,
// con botones correspondientes en donde se encuentran los cubículos".
//
// Cada cubículo es un botón colocado en su posición física (pos_x / pos_y, en % del piso).
// Al tocarlo se abre su ficha con las acciones que ya existen (liberar, bloquear).
// En "Editar plano" los botones se arrastran y el admin guarda la nueva ubicación.

const ETIQUETA = { disponible: 'Disponible', ocupado: 'En uso', reservado: 'Reservado', bloqueado: 'Bloqueado' }
const ORDEN = ['disponible', 'ocupado', 'reservado', 'bloqueado']
const PASO = 2 // la rejilla del editor: cada movimiento se ajusta a múltiplos del 2 %
const MARGEN = 7 // un botón nunca queda pegado al borde del plano

const clave = (c) => `${c.Piso}-${c.ID_Cubiculo}`
const ajustar = (v) => Math.min(100 - MARGEN, Math.max(MARGEN, Math.round(v / PASO) * PASO))
const hora12 = (h) => (Number.isFinite(h) ? `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}` : '—')

function IconoEditar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconoArrastre() {
  return (
    <svg className="admin-map-grip" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
      {[2, 7, 12].flatMap((y) => [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
    </svg>
  )
}

function IconoPlano() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#212e84" strokeWidth="2" />
      <path d="M3 10h7v11M14 3v7h7" stroke="#212e84" strokeWidth="2" />
    </svg>
  )
}

export default function AdminFloorMap({
  cubiculos,
  floors,
  estadoDe,
  nombreDe,
  correo,
  onLiberar,
  onBloquear,
  onGuardarPlano,
}) {
  const [piso, setPiso] = useState(1)
  const [seleccion, setSeleccion] = useState(null)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState({}) // clave -> { x, y } mientras se edita
  const [arrastrando, setArrastrando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [bloqueando, setBloqueando] = useState(false)
  const plano = useRef(null)

  const delPiso = useMemo(
    () =>
      cubiculos
        .filter((c) => Number(c.Piso) === piso)
        .sort((a, b) => Number(a.ID_Cubiculo) - Number(b.ID_Cubiculo)),
    [cubiculos, piso],
  )

  const ubicados = delPiso.filter((c) => tienePosicion(c) || borrador[clave(c)])
  const sinUbicar = delPiso.filter((c) => !tienePosicion(c) && !borrador[clave(c)])

  // Fuera del editor se ve exactamente lo mismo que ve el estudiante (plano.js).
  // En el editor solo están los ubicados; los demás esperan en la bandeja "Sin ubicar".
  const piezas = editando
    ? ubicados.map((cub) => ({ cub, x: Number(borrador[clave(cub)]?.x ?? cub.Pos_X), y: Number(borrador[clave(cub)]?.y ?? cub.Pos_Y) }))
    : posicionesDelPiso(delPiso).piezas

  const piezasFinales = piezas.map((p) => ({ ...p, ...(borrador[clave(p.cub)] ?? {}) }))
  const estados = Object.fromEntries(delPiso.map((c) => [clave(c), estadoDe(c)]))
  const conteo = ORDEN.map((e) => [e, delPiso.filter((c) => estados[clave(c)].status === e).length])
  const cambios = Object.keys(borrador).length

  const elegido = seleccion && delPiso.find((c) => clave(c) === seleccion)
  const fichaElegida = elegido ? estados[clave(elegido)] : null

  const cambiarPiso = (p) => {
    setPiso(p)
    elegir(null)
  }

  // Al cambiar de cubículo se descarta el motivo de bloqueo que se estaba escribiendo.
  function elegir(k) {
    setSeleccion(k)
    setPidiendoMotivo(false)
    setMotivo('')
  }

  // Mismo flujo que BlockToggle de la tabla: bloquear pide motivo, desbloquear es directo.
  const ejecutarBloqueo = async (bloquear) => {
    setBloqueando(true)
    const ok = await onBloquear?.(elegido, bloquear, motivo.trim())
    setBloqueando(false)
    if (ok !== false) {
      setPidiendoMotivo(false)
      setMotivo('')
    }
  }

  const salirDeEdicion = () => {
    setEditando(false)
    setBorrador({})
    setArrastrando(null)
  }

  const guardar = async () => {
    setGuardando(true)
    const ok = await onGuardarPlano?.(
      Object.entries(borrador).map(([k, pos]) => {
        const [p, n] = k.split('-').map(Number)
        return { piso: p, cubiculo: n, ...pos }
      }),
    )
    setGuardando(false)
    // Si la base rechazó el cambio, el borrador se conserva para reintentar.
    if (ok !== false) salirDeEdicion()
  }

  // Arrastre con Pointer Events: funciona igual con mouse, lápiz y dedo.
  const posicionEn = (evento) => {
    const r = plano.current.getBoundingClientRect()
    return {
      x: ajustar(((evento.clientX - r.left) / r.width) * 100),
      y: ajustar(((evento.clientY - r.top) / r.height) * 100),
    }
  }

  const empezar = (evento, cub) => {
    if (!editando) return
    evento.preventDefault()
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
    setArrastrando(clave(cub))
    setSeleccion(clave(cub))
  }

  const mover = (evento) => {
    if (!arrastrando) return
    setBorrador((b) => ({ ...b, [arrastrando]: posicionEn(evento) }))
  }

  const soltar = () => setArrastrando(null)

  // Teclado en modo edición: flechas mueven el cubículo seleccionado un paso de rejilla.
  const teclado = (evento, cub, x, y) => {
    if (!editando) return
    const delta = { ArrowLeft: [-PASO, 0], ArrowRight: [PASO, 0], ArrowUp: [0, -PASO], ArrowDown: [0, PASO] }[evento.key]
    if (!delta) return
    evento.preventDefault()
    setBorrador((b) => ({ ...b, [clave(cub)]: { x: ajustar(x + delta[0]), y: ajustar(y + delta[1]) } }))
  }

  const colocarDesdeBandeja = (cub) =>
    setBorrador((b) => ({ ...b, [clave(cub)]: { x: 50, y: 46 } }))

  const posElegida = elegido && piezasFinales.find((p) => clave(p.cub) === seleccion)

  return (
    <section
      className={`admin-panel admin-map-panel${editando ? ' is-editing' : ''}`}
      id="mapa"
      aria-labelledby="map-heading"
    >
      <div className="admin-panel-heading admin-map-heading">
        <h2 id="map-heading">
          <span className="admin-icon-box"><IconoPlano /></span>
          Mapa de Cubículos
          <span className="admin-map-count">Piso {piso} · {delPiso.length} cubículos</span>
        </h2>
        <div className="admin-map-controls">
          <div className="admin-floor-tabs" aria-label="Piso del mapa">
            {floors.map((p) => (
              <button
                type="button"
                key={p}
                className={p === piso ? 'is-active' : ''}
                aria-pressed={p === piso}
                onClick={() => cambiarPiso(p)}
              >
                Piso {p}
              </button>
            ))}
          </div>
          {!editando && (
            <button type="button" className="admin-map-edit" onClick={() => setEditando(true)}>
              <IconoEditar />
              Editar plano
            </button>
          )}
        </div>
      </div>

      {editando && (
        <div className="admin-map-editbar" role="status">
          <span className="admin-map-editbar-dot" aria-hidden="true" />
          <p>
            <strong>Modo edición.</strong> Arrastra cada cubículo hasta donde está en la biblioteca.
            <span> También puedes usar las flechas del teclado.</span>
          </p>
          <div className="admin-map-editbar-actions">
            <button type="button" className="admin-map-ghost" onClick={salirDeEdicion}>
              Cancelar
            </button>
            <button type="button" className="admin-map-save" disabled={!cambios || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : `Guardar plano${cambios ? ` (${cambios})` : ''}`}
            </button>
          </div>
        </div>
      )}

      <div className="admin-map-body">
        <figure className="floor-figure admin-map-figure">
          <div
            ref={plano}
            className={`floor-plan admin-floor-plan${editando ? ' is-editing' : ''}`}
            role="group"
            aria-label={`Plano del piso ${piso}`}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            {(REFERENCIAS[piso] ?? []).map((r, i) => (
              <div
                key={`${r.tipo}-${i}`}
                className={`floor-ref floor-ref-${r.tipo}`}
                style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.ancho}%`, height: `${r.alto}%` }}
                aria-hidden="true"
              >
                <span>{r.etiqueta}</span>
              </div>
            ))}

            {piezasFinales.map(({ cub, x, y }) => {
              const k = clave(cub)
              const { status, reservation } = estados[k]
              const fin = reservation ? aHoras(reservation.Franja_Horaria)[1] : null
              const clases = [
                'admin-map-cubicle',
                status,
                seleccion === k && 'is-selected',
                arrastrando === k && 'is-dragging',
                borrador[k] && 'is-moved',
              ].filter(Boolean).join(' ')
              return (
                <button
                  type="button"
                  key={k}
                  className={clases}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-pressed={seleccion === k}
                  aria-label={`Cubículo ${cub.ID_Cubiculo}, ${ETIQUETA[status]}${editando ? `, posición ${x} % por ${y} %` : ''}`}
                  onClick={() => elegir(seleccion === k && !editando ? null : k)}
                  onPointerDown={(e) => empezar(e, cub)}
                  onKeyDown={(e) => teclado(e, cub, x, y)}
                >
                  {editando && <IconoArrastre />}
                  <span className="admin-map-cubicle-num">{String(cub.ID_Cubiculo).padStart(2, '0')}</span>
                  <span className="admin-map-cubicle-state">
                    <i aria-hidden="true" />
                    {ETIQUETA[status]}
                  </span>
                  {!editando && (
                    <span className="admin-map-cubicle-meta">
                      {status === 'ocupado' && `hasta ${hora12(fin)}`}
                      {status === 'reservado' && `desde ${hora12(aHoras(reservation.Franja_Horaria)[0])}`}
                      {status === 'disponible' && '6 personas'}
                      {status === 'bloqueado' && 'Mantenimiento'}
                    </span>
                  )}
                  {editando && (
                    <span className="admin-map-cubicle-meta">{x}% · {y}%</span>
                  )}
                </button>
              )
            })}
          </div>

          <figcaption className="admin-map-legend">
            {conteo.map(([estado, n]) => (
              <span key={estado} className={`admin-map-legend-item ${estado}`}>
                <i aria-hidden="true" />
                {ETIQUETA[estado]}
                <b>{n}</b>
              </span>
            ))}
            {!editando && ubicados.length > 0 && sinUbicar.length > 0 && (
              <button type="button" className="admin-map-unplaced" onClick={() => setEditando(true)}>
                {sinUbicar.length} sin ubicar en el plano
              </button>
            )}
          </figcaption>
        </figure>

        <aside className="admin-map-side" aria-live="polite">
          {editando ? (
            <>
              <h3 className="admin-map-side-title">Sin ubicar</h3>
              <p className="admin-map-side-help">
                Cubículos recién registrados que todavía no tienen lugar en el plano.
              </p>
              {sinUbicar.length ? (
                <ul className="admin-map-tray">
                  {sinUbicar.map((c) => (
                    <li key={clave(c)}>
                      <span className="admin-map-tray-num">{String(c.ID_Cubiculo).padStart(2, '0')}</span>
                      <span>Cubículo {c.ID_Cubiculo}</span>
                      <button type="button" onClick={() => colocarDesdeBandeja(c)}>Colocar</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-map-tray-empty">Todos los cubículos del piso están ubicados.</p>
              )}

              <div className="admin-map-coords">
                <h3 className="admin-map-side-title">Seleccionado</h3>
                {posElegida ? (
                  <dl>
                    <div><dt>Cubículo</dt><dd>{elegido.ID_Cubiculo}</dd></div>
                    <div><dt>Horizontal</dt><dd>{posElegida.x} %</dd></div>
                    <div><dt>Vertical</dt><dd>{posElegida.y} %</dd></div>
                  </dl>
                ) : (
                  <p className="admin-map-side-help">Toca un cubículo para ver su posición.</p>
                )}
              </div>
            </>
          ) : elegido ? (
            <div className="admin-map-detail">
              <div className="admin-map-detail-head">
                <span className={`admin-map-detail-num ${fichaElegida.status}`}>
                  {String(elegido.ID_Cubiculo).padStart(2, '0')}
                </span>
                <div>
                  <h3>Cubículo {elegido.ID_Cubiculo}</h3>
                  <p>Piso {elegido.Piso} · Capacidad {elegido.Capacidad}</p>
                </div>
                <button type="button" className="admin-map-close" aria-label="Cerrar ficha" onClick={() => elegir(null)}>
                  ×
                </button>
              </div>

              <span className={`admin-status-badge ${fichaElegida.status}`}>{ETIQUETA[fichaElegida.status]}</span>

              <dl className="admin-map-facts">
                <div>
                  <dt>{fichaElegida.status === 'reservado' ? 'Próxima reserva' : 'Reservado por'}</dt>
                  <dd>{fichaElegida.reservation ? nombreDe(fichaElegida.reservation) : '—'}</dd>
                </div>
                <div>
                  <dt>Franja</dt>
                  <dd>
                    {fichaElegida.reservation
                      ? aHoras(fichaElegida.reservation.Franja_Horaria).map(hora12).join(' – ')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Integrantes</dt>
                  <dd>{fichaElegida.reservation ? `${fichaElegida.reservation.Personas} personas` : '—'}</dd>
                </div>
                {elegido.Estado === 'Bloqueado' && (
                  <div>
                    <dt>Motivo</dt>
                    <dd>{elegido.Motivo_Bloqueo || 'Mantenimiento'}</dd>
                  </div>
                )}
              </dl>

              <div className="admin-map-actions">
                <button
                  type="button"
                  className="admin-map-action orange"
                  disabled={fichaElegida.status !== 'ocupado'}
                  onClick={() => onLiberar?.({ cubicle: elegido, reservation: fichaElegida.reservation })}
                >
                  <img src={keyIcon} alt="" />
                  Liberar
                </button>
                <button
                  type="button"
                  className={`admin-map-action ${elegido.Estado === 'Bloqueado' ? 'green' : 'navy'}`}
                  disabled={!correo || bloqueando || pidiendoMotivo}
                  onClick={() => (elegido.Estado === 'Bloqueado' ? ejecutarBloqueo(false) : setPidiendoMotivo(true))}
                >
                  <img src={elegido.Estado === 'Bloqueado' ? greenKeyIcon : lockIcon} alt="" />
                  {elegido.Estado === 'Bloqueado' ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>

              {pidiendoMotivo && (
                <form
                  className="admin-map-reason"
                  onSubmit={(evento) => {
                    evento.preventDefault()
                    ejecutarBloqueo(true)
                  }}
                >
                  <label htmlFor="admin-map-motivo">Motivo del bloqueo</label>
                  <input
                    id="admin-map-motivo"
                    autoFocus
                    value={motivo}
                    maxLength={300}
                    onChange={(evento) => setMotivo(evento.target.value)}
                    placeholder="Mantenimiento, aire acondicionado…"
                  />
                  <div>
                    <button type="button" className="admin-map-ghost" onClick={() => setPidiendoMotivo(false)}>
                      Volver
                    </button>
                    <button type="submit" className="admin-map-save" disabled={bloqueando}>
                      {bloqueando ? 'Bloqueando…' : 'Confirmar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="admin-map-empty">
              <span className="admin-map-empty-icon" aria-hidden="true"><IconoPlano /></span>
              <h3>Selecciona un cubículo</h3>
              <p>Toca cualquier botón del plano para ver quién lo ocupa y liberarlo o bloquearlo.</p>
              <ul className="admin-map-summary">
                {conteo.map(([estado, n]) => (
                  <li key={estado} className={estado}>
                    <b>{n}</b>
                    <span>{ETIQUETA[estado]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
