import { useState } from 'react'
import { canjearCubiculoFavorito, canjearRecompensa, quitarCubiculoFavorito } from '../api/library'
import { useLibrary } from '../hooks/useLibrary'
import CubicleMap from '../components/map/CubicleMap'
import { useAuth } from '../context/AuthContext'
import { horaActual, hoyISO } from '../utils/time'
import { CATALOGO_BASE_RECOMPENSAS, RANGOS_RECOMPENSAS, rangoPorHoras } from '../utils/rewards'
import './Recompensas.css'

import samRoot from '../assets/rewards/saman-tree-01.svg'
import samCanopy from '../assets/rewards/saman-tree-02.svg'
import samTrunkBase from '../assets/rewards/saman-tree-03.svg'
import samTrunk from '../assets/rewards/saman-tree-04.svg'
import samBranchLeft from '../assets/rewards/saman-tree-05.svg'
import samBranchRight from '../assets/rewards/saman-tree-06.svg'
import samCanopyTop from '../assets/rewards/saman-tree-07.svg'
import samCanopyDetail from '../assets/rewards/saman-tree-08.svg'
import samFlower01 from '../assets/rewards/saman-tree-09.svg'
import samFlower02 from '../assets/rewards/saman-tree-10.svg'
import samFlower03 from '../assets/rewards/saman-tree-11.svg'
import samFlower04 from '../assets/rewards/saman-tree-12.svg'
import samFlower05 from '../assets/rewards/saman-tree-13.svg'
import samFlower06 from '../assets/rewards/saman-tree-14.svg'
import samFlower07 from '../assets/rewards/saman-tree-15.svg'
import samFlower08 from '../assets/rewards/saman-tree-16.svg'
import samFlower09 from '../assets/rewards/saman-tree-17.svg'
import samFlower10 from '../assets/rewards/saman-tree-18.svg'
import samFlower11 from '../assets/rewards/saman-tree-19.svg'
import samFlower12 from '../assets/rewards/saman-tree-20.svg'
import samFlower13 from '../assets/rewards/saman-tree-21.svg'
import samFlower14 from '../assets/rewards/saman-tree-22.svg'
import samFlower15 from '../assets/rewards/saman-tree-23.svg'
import advanceIcon from '../assets/rewards/benefit-1.svg'
import expressIcon from '../assets/rewards/benefit-2.svg'
import favoriteIcon from '../assets/rewards/benefit-3.svg'
import cancellationIcon from '../assets/rewards/benefit-4.svg'

const TREE_PARTS = [
  { src: samRoot, inset: '9.2% 16%', bleed: '-0.37%' },
  { src: samCanopy, inset: '12.8% 19%', bleed: '-0.4%' },
  { src: samTrunkBase, inset: '81.8% 27% 14.6%' },
  { src: samTrunk, inset: '35.6% 28% 17.6%', bleed: '-1.28% -1.14%' },
  { src: samBranchLeft, inset: '44.6% 51% 17.6% 29.45%' },
  { src: samBranchRight, inset: '44.6% 29.45% 17.6% 51%' },
  { src: samCanopyTop, inset: '22.4% 18.14% 51.2%', bleed: '-1.7% -0.59% -2.33% -0.59%' },
  { src: samCanopyDetail, inset: '27.2% 24% 57.2%', bleed: '-1.92% -0.48%' },
  { src: samFlower01, inset: '20% 48% 75.2% 48%', flower: true },
  { src: samFlower02, inset: '21.32% 49.1% 76.52% 49.1%', flower: true },
  { src: samFlower03, inset: '22.7% 59.25% 73.1% 37.25%', flower: true },
  { src: samFlower04, inset: '23.9% 60.25% 74.3% 38.25%', flower: true },
  { src: samFlower05, inset: '22.7% 37.25% 73.1% 59.25%', flower: true },
  { src: samFlower06, inset: '23.9% 38.25% 74.3% 60.25%', flower: true },
  { src: samFlower07, inset: '28.7% 69.25% 67.1% 27.25%', flower: true },
  { src: samFlower08, inset: '29.9% 70.25% 68.3% 28.25%', flower: true },
  { src: samFlower03, inset: '28.7% 27.25% 67.1% 69.25%', flower: true },
  { src: samFlower09, inset: '29.9% 28.25% 68.3% 70.25%', flower: true },
  { src: samFlower10, inset: '38.6% 77.5% 57.8% 19.5%', flower: true },
  { src: samFlower11, inset: '38.6% 19.5% 57.8% 77.5%', flower: true },
  { src: samFlower12, inset: '33.92% 63.6% 62.72% 33.6%', flower: true },
  { src: samFlower12, inset: '33.92% 33.6% 62.72% 63.6%', flower: true },
  { src: samFlower13, inset: '30.32% 53.6% 66.32% 43.6%', flower: true },
  { src: samFlower13, inset: '30.32% 43.6% 66.32% 53.6%', flower: true },
  { src: samFlower14, inset: '36.5% 48.75% 60.5% 48.75%', flower: true },
  { src: samFlower15, inset: '81.8% 49% 15.8% 49%' },
]

const ICONOS_BENEFICIO = {
  VENTANA_ANTICIPADA: { icono: advanceIcon, tono: 'verde' },
  PASE_EXPRESS: { icono: expressIcon, tono: 'naranja' },
  FAVORITO: { icono: favoriteIcon, tono: 'amarillo' },
  CANCELACION_TARDIA: { icono: cancellationIcon, tono: 'azul' },
}

const NIVELES_ARBOL = [
  1, 3, 1, 1, 2, 2, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 12, 12, 12, 12,
]

function ArbolSaman({ crecimiento }) {
  return (
    <div className="rewards-tree" aria-hidden="true">
      {crecimiento === 0 && <span className="rewards-tree-seed">🌱</span>}
      {TREE_PARTS.map((part, index) => (
        <span
          className={`rewards-tree-part${part.flower ? ' is-flower' : ''}`}
          key={`${index}-${part.inset}`}
          style={{ inset: part.inset }}
          hidden={NIVELES_ARBOL[index] > crecimiento}
        >
          <span className="rewards-tree-part-art" style={part.bleed ? { inset: part.bleed } : undefined}>
            <img src={part.src} alt="" />
          </span>
        </span>
      ))}
    </div>
  )
}

function RangoCard({ rango, actual }) {
  const superado = rango.nivel < actual.nivel
  const activo = rango.nivel === actual.nivel
  const tope = rango.hasta ? `${rango.desde} – ${rango.hasta - 1} hrs` : '100+ hrs'

  return (
    <div className={`reward-tier reward-tier-${rango.tono}${activo ? ' is-current' : ''}${superado ? ' is-passed' : ''}`}>
      {activo && <span className="reward-tier-marker">TÚ</span>}
      <span className="reward-tier-icon" aria-hidden="true">{rango.icono}</span>
      <strong>{rango.nombre}</strong>
      <span className="reward-tier-hours">{tope}</span>
      <span className="reward-tier-status">{superado ? 'Superado' : activo ? 'Activo' : 'Bloqueado'}</span>
    </div>
  )
}

function BeneficioCard({ beneficio, saldo, onCanjear, soloLectura = false }) {
  const datosVisuales = ICONOS_BENEFICIO[beneficio.tipo] || {}
  const disponible = !soloLectura && saldo >= Number(beneficio.costo_horas) && (beneficio.stock === null || beneficio.stock > 0)
  const faltan = Math.max(0, Number(beneficio.costo_horas) - saldo)
  const tieneFavorito = beneficio.tipo === 'FAVORITO' && beneficio.yaTieneFavorito
  const agotado = beneficio.stock !== null && beneficio.stock <= 0

  return (
    <article className={`reward-benefit-card tone-${datosVisuales.tono || 'verde'}`}>
      <div className="reward-benefit-main">
        <div className="reward-benefit-top">
          <span className="reward-benefit-icon">
            <img src={datosVisuales.icono} alt="" />
          </span>
          <span className={`reward-cost${disponible ? '' : ' is-unavailable'}`}>{beneficio.costo_horas} Horas</span>
        </div>
        <h3>{beneficio.nombre}</h3>
        <p>{beneficio.descripcion}</p>
        {!soloLectura && beneficio.stock !== null && <span className="reward-stock">Stock disponible: {beneficio.stock}</span>}
      </div>
      <div className="reward-benefit-actions">
        <span className={`reward-balance-state${disponible ? '' : ' is-short'}`}>
          {soloLectura
            ? 'Consulta el catálogo para ver disponibilidad y saldo'
            : tieneFavorito
              ? 'Ya tienes un cubículo favorito'
              : agotado
                ? 'Agotada'
                : disponible
                  ? '✓ Saldo suficiente'
                  : `Te faltan ${faltan} horas`}
        </span>
        <button type="button" disabled={soloLectura || !disponible || tieneFavorito} onClick={() => onCanjear(beneficio)}>
          {soloLectura
            ? 'Canje no disponible'
            : tieneFavorito
              ? 'Favorito activo'
              : beneficio.tipo === 'FAVORITO'
                ? 'Elegir cubículo'
                : disponible
                  ? 'Canjear Beneficio'
                  : agotado
                    ? 'Sin stock'
                    : 'Horas Insuficientes'}
        </button>
      </div>
    </article>
  )
}

export default function Recompensas() {
  const {
    correo,
    rol,
    horasRecompensas,
    recompensasCargando,
    recompensasError,
    refrescarRecompensas,
  } = useAuth()
  const { cubiculos, reservas, cargando: cargandoMapa, error: errorMapa } = useLibrary()
  const [mensaje, setMensaje] = useState('')
  const [mostrarMapaFavorito, setMostrarMapaFavorito] = useState(false)
  const [pisoFavorito, setPisoFavorito] = useState(1)
  const [recompensaFavorito, setRecompensaFavorito] = useState('')
  const [canjeando, setCanjeando] = useState(false)
  const rango = rangoPorHoras(horasRecompensas.acumuladas)
  const siguienteRango = RANGOS_RECOMPENSAS.find((item) => item.nivel === rango.nivel + 1)
  const faltan = siguienteRango ? Math.max(0, siguienteRango.desde - horasRecompensas.acumuladas) : 0
  const horasDoceSemanas = horasRecompensas.semanas.reduce((total, semana) => total + Number(semana.horas || 0), 0)
  const crecimiento = Math.min(12, Math.floor(horasDoceSemanas / 10))
  const progreso = siguienteRango
    ? Math.min(100, ((horasRecompensas.acumuladas - rango.desde) / (siguienteRango.desde - rango.desde)) * 100)
    : 100

  const canjear = async (beneficio) => {
    if (beneficio.tipo === 'FAVORITO') {
      setRecompensaFavorito(beneficio.id)
      setPisoFavorito(Number(cubiculos[0]?.Piso) || 1)
      setMostrarMapaFavorito(true)
      setMensaje('Selecciona en el mapa el cubículo que deseas marcar como favorito.')
      return
    }
    setCanjeando(true)
    const res = await canjearRecompensa(correo, beneficio.id)
    setCanjeando(false)
    if (res.status !== 'ok') {
      setMensaje(res.mensaje || 'No se pudo canjear la recompensa.')
      return
    }
    const actualizacion = await refrescarRecompensas()
    setMensaje(actualizacion.status === 'ok' ? (res.mensaje || 'Recompensa canjeada.') : 'El canje se realizó, pero no se pudo actualizar el saldo. Recarga la página.')
  }

  const elegirFavorito = async (cubiculo) => {
    setCanjeando(true)
    const res = await canjearCubiculoFavorito(correo, recompensaFavorito, cubiculo.Piso, cubiculo.ID_Cubiculo)
    setCanjeando(false)
    if (res.status !== 'ok') {
      setMensaje(res.mensaje || 'No se pudo guardar el cubículo favorito.')
      return
    }
    setMostrarMapaFavorito(false)
    const actualizacion = await refrescarRecompensas()
    setMensaje(actualizacion.status === 'ok' ? 'Cubículo favorito elegido y horas canjeadas.' : 'El canje se realizó, pero no se pudo actualizar el saldo. Recarga la página.')
  }

  const deseleccionarFavorito = async () => {
    const res = await quitarCubiculoFavorito(correo)
    if (res.status !== 'ok') {
      setMensaje(res.mensaje || 'No se pudo quitar el cubículo favorito.')
      return
    }
    const actualizacion = await refrescarRecompensas()
    setMensaje(actualizacion.status === 'ok' ? 'Cubículo favorito quitado. Puedes canjear de nuevo para elegir otro.' : 'Se quitó el favorito, pero no se pudo actualizar el saldo.')
  }

  const pisosFavoritos = [...new Set(cubiculos.map((cubiculo) => Number(cubiculo.Piso)))].sort((a, b) => a - b)
  const seleccionadoFavorito = horasRecompensas.favorito?.split('-')
  const mostrarCatalogoBase = recompensasCargando || recompensasError
  const catalogo = mostrarCatalogoBase ? CATALOGO_BASE_RECOMPENSAS : horasRecompensas.catalogo

  return (
    <div className="rewards-page">
      <section className="rewards-intro">
        <h1>Recompensas &amp; Rango Unimetano</h1>
        <p>Acumula horas de estudio, consulta tu nivel y descubre beneficios exclusivos en el campus.</p>
      </section>

      {recompensasError && (
        <p className="rewards-data-error" role="alert">
          No fue posible consultar tus horas ni la disponibilidad actual. Se muestra el Nivel 1 como nivel inicial y el catálogo base como referencia; el canje estará disponible cuando se recupere la conexión.
        </p>
      )}

      {rol !== 'admin' && recompensasCargando && <p role="status">Consultando tu saldo; tu nivel inicial es Nivel 1.</p>}
      {rol !== 'admin' && <section className="rewards-summary-card" aria-label="Tu rango y progreso">
        <div className="rewards-tree-card">
          <span className="rewards-tree-chip">Crecimiento de 12 semanas</span>
          <span className="rewards-week-chip">Semana {crecimiento} de 12</span>
          <ArbolSaman crecimiento={crecimiento} />
          <div className="rewards-tree-copy">
            <h2>Samán en Crecimiento</h2>
            <p>{horasDoceSemanas.toFixed(1)} horas acumuladas en tus últimas 12 semanas.</p>
          </div>
        </div>

        <div className="rewards-progress-column">
          <div className="rewards-metrics">
            <article className="rewards-metric metric-total">
              <span className="rewards-metric-label">Total acumulado</span>
              <strong>{horasRecompensas.acumuladas.toFixed(1)} <small>horas</small></strong>
              <span className="rewards-metric-note">
                {recompensasCargando ? 'Calculando tus horas…' : `↑ +${horasRecompensas.estaSemana.toFixed(1)} hrs esta semana`}
              </span>
            </article>
            <article className="rewards-metric metric-balance">
              <span className="rewards-metric-label">Saldo canjeable</span>
              <strong>{horasRecompensas.saldo.toFixed(1)} <small>horas</small></strong>
              <span className="rewards-metric-note">Disponibles para beneficios</span>
            </article>
            <article className={`rewards-metric metric-rank rank-${rango.tono}`} style={{ '--rank-color': rango.color }}>
              <span className="rewards-metric-label">Rango actual</span>
              <strong>{rango.icono} {rango.nombre}</strong>
              <span className="rewards-metric-note">
                Nivel {rango.nivel} ({rango.desde} – {rango.hasta ? `${rango.hasta - 1}` : '100+'} hrs)
              </span>
            </article>
          </div>

          <div className="rewards-level-progress">
            <div className="rewards-progress-heading">
              <strong>
                {siguienteRango ? `Progreso a Nivel ${siguienteRango.nivel}:` : '¡Rango máximo alcanzado!'}
                {siguienteRango && <span> {siguienteRango.icono} {siguienteRango.nombre}</span>}
              </strong>
              <span className="rewards-hours-left" style={{ '--rank-color': rango.color }}>
                {siguienteRango ? `Te faltan ${faltan} horas` : '¡Felicitaciones!'}
              </span>
            </div>
            <div
              className="rewards-progress-track"
              role="progressbar"
              aria-label={siguienteRango ? `Progreso al nivel ${siguienteRango.nivel}` : 'Rango máximo alcanzado'}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(progreso)}
              style={{ '--rank-color': rango.color }}
            >
              <span style={{ width: `${progreso}%` }} />
            </div>
            <div className="rewards-progress-labels">
              <span>Nivel {rango.nivel}: {rango.desde} hrs</span>
              <strong>{horasRecompensas.acumuladas.toFixed(0)} hrs actuales</strong>
              <span>{siguienteRango ? `Meta Nivel ${siguienteRango.nivel}: ${siguienteRango.desde} hrs` : 'Nivel máximo'}</span>
            </div>
          </div>

          <div className="rewards-tiers">
            <h2>Escala de rangos Unimetanos</h2>
            <div className="rewards-tier-list">
              {RANGOS_RECOMPENSAS.map((item) => (
                <RangoCard key={item.nivel} rango={item} actual={rango} />
              ))}
            </div>
          </div>
        </div>
      </section>}

      <div className="rewards-lower-grid">
        <section className="rewards-catalog" aria-labelledby="rewards-catalog-title">
          <div className="rewards-section-heading">
            <div>
              <h2 id="rewards-catalog-title">Catálogo de Beneficios</h2>
              <span>{mostrarCatalogoBase ? `${CATALOGO_BASE_RECOMPENSAS.length} Beneficios` : `${catalogo.length} Disponibles`}</span>
            </div>
            <p>Consulta los beneficios disponibles para canjear tus horas</p>
          </div>
          {mostrarCatalogoBase && (
            <p className="rewards-catalog-note" role="status">
              {recompensasCargando ? 'Mostrando el catálogo base mientras se consultan los datos actuales.' : 'Catálogo base de referencia; no se pueden realizar canjes hasta recuperar la conexión.'}
            </p>
          )}
          {catalogo.length ? <div className="rewards-benefit-grid">
            {catalogo.map((beneficio) => (
              <BeneficioCard
                key={beneficio.id}
                beneficio={{ ...beneficio, yaTieneFavorito: Boolean(horasRecompensas.favorito) }}
                saldo={horasRecompensas.saldo}
                onCanjear={canjear}
                soloLectura={mostrarCatalogoBase}
              />
            ))}
          </div> : <p>Aún no hay recompensas disponibles.</p>}
          <p className="rewards-disclaimer">
            {horasRecompensas.ventana48Restantes
              ? `Tu ventana extendida tiene ${horasRecompensas.ventana48Restantes} reserva(s) restante(s) de las cinco.`
              : 'Las horas se acreditan al completar el check-in y el check-out de una reserva.'}
          </p>
        </section>

        <aside className="rewards-sidebar">
          <section className="rewards-active-benefits">
            <h2>Mis Beneficios en Vigencia</h2>
            <p>Beneficios listos para tus reservas:</p>
            {horasRecompensas.ventana48Restantes > 0 && (
              <p className="rewards-active-pass">Ventana de 48 horas · {horasRecompensas.ventana48Restantes} reservas restantes</p>
            )}
            {horasRecompensas.favorito ? (
              <div className="rewards-active-pass">
                ❤️ Cubículo {seleccionadoFavorito?.[1]} · Piso {seleccionadoFavorito?.[0]}
                <button type="button" onClick={deseleccionarFavorito}>Quitar favorito</button>
              </div>
            ) : (
              <div className="rewards-empty-benefits">Aún no tienes beneficios activos.</div>
            )}
          </section>
          <section className="rewards-redemption-history">
            <div className="rewards-history-heading">
              <h2>Historial Reciente de Canje</h2>
            </div>
            {horasRecompensas.historial.length ? (
              <ul className="rewards-history-list">
                {horasRecompensas.historial.slice(0, 8).map((evento, index) => (
                  <li key={`${evento.tipo}-${evento.id_reserva}-${index}`}>
                    <span>{evento.detalle}</span>
                    <time>{evento.fecha}</time>
                    <strong className={evento.horas < 0 ? 'is-spent' : ''}>
                      {evento.horas > 0 ? '+' : ''}{Number(evento.horas).toFixed(2)} h
                      {evento.bono_favorito > 0 ? ` (+${evento.bono_favorito} favorito)` : ''}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rewards-empty-history">Todavía no hay horas ganadas ni canjes registrados.</p>
            )}
            <p className="rewards-history-footnote">Las inasistencias sin check-in y check-out no generan horas.</p>
          </section>
        </aside>
      </div>

      {(canjeando || recompensasCargando) && <p className="rewards-feedback" role="status">Actualizando recompensas…</p>}
      {mensaje && <p className="rewards-feedback" role="status" aria-live="polite">{mensaje}</p>}

      {mostrarMapaFavorito && (
        <div className="favorite-map-overlay" role="presentation" onClick={() => setMostrarMapaFavorito(false)}>
          <section
            className="favorite-map-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="favorite-map-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="favorite-map-heading">
              <div>
                <h2 id="favorite-map-title">Elige tu cubículo favorito</h2>
                <p>El canje se realizará al seleccionar un cubículo.</p>
              </div>
              <button type="button" onClick={() => setMostrarMapaFavorito(false)} aria-label="Cerrar mapa">×</button>
            </div>
            {pisosFavoritos.length > 1 && (
              <div className="favorite-floor-tabs" role="group" aria-label="Seleccionar piso">
                {pisosFavoritos.map((piso) => (
                  <button type="button" key={piso} aria-pressed={pisoFavorito === piso} onClick={() => setPisoFavorito(piso)}>
                    Piso {piso}
                  </button>
                ))}
              </div>
            )}
            {cargandoMapa ? <p>Cargando mapa…</p> : errorMapa ? <p role="alert">No se pudo cargar el mapa de cubículos.</p> : (
              <CubicleMap
                cubiculos={cubiculos}
                reservas={reservas}
                piso={pisoFavorito}
                fecha={hoyISO()}
                hora={horaActual()}
                seleccionado={null}
                esAdmin={false}
                onSelect={elegirFavorito}
              />
            )}
            {canjeando && <p role="status">Canjeando horas…</p>}
          </section>
        </div>
      )}
    </div>
  )
}
