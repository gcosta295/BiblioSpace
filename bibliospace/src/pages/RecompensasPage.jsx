import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { RANGOS_RECOMPENSAS, rangoPorHoras } from '../utils/rewards'
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

const BENEFICIOS = [
  {
    titulo: 'Reserva Anticipada (Ventana Extendida)',
    descripcion: 'Habilita reservar un cubículo de estudio con 48 o 72 horas de antelación en lugar del límite estándar de 24 horas.',
    costo: 20,
    icono: advanceIcon,
    tono: 'verde',
  },
  {
    titulo: 'Extensión de Tiempo (Pase Express)',
    descripcion: 'Permite extender la sesión de cubículo +1 hora continua (3 horas en lugar de 2), sujeto a disponibilidad de sala.',
    costo: 15,
    icono: expressIcon,
    tono: 'naranja',
  },
  {
    titulo: 'Selección de Cubículo VIP / Favorito',
    descripcion: 'Bloquea prioritariamente tu cubículo favorito ante alta demanda semanal.',
    costo: 30,
    icono: favoriteIcon,
    tono: 'amarillo',
  },
  {
    titulo: 'Comodín de Cancelación Tardía',
    descripcion: 'Cancela una reserva fuera del tiempo reglamentario sin penalización en el registro unimetano de uso de cubículos.',
    costo: 10,
    icono: cancellationIcon,
    tono: 'azul',
  },
]

function ArbolSaman() {
  return (
    <div className="rewards-tree" aria-hidden="true">
      {TREE_PARTS.map((part, index) => (
        <span
          className={`rewards-tree-part${part.flower ? ' is-flower' : ''}`}
          key={`${index}-${part.inset}`}
          style={{ inset: part.inset }}
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

function BeneficioCard({ beneficio, saldo, onCanjear }) {
  const disponible = saldo >= beneficio.costo
  const faltan = Math.max(0, beneficio.costo - saldo)

  return (
    <article className={`reward-benefit-card tone-${beneficio.tono}`}>
      <div className="reward-benefit-main">
        <div className="reward-benefit-top">
          <span className="reward-benefit-icon">
            <img src={beneficio.icono} alt="" />
          </span>
          <span className={`reward-cost${disponible ? '' : ' is-unavailable'}`}>{beneficio.costo} Horas</span>
        </div>
        <h3>{beneficio.titulo}</h3>
        <p>{beneficio.descripcion}</p>
      </div>
      <div className="reward-benefit-actions">
        <span className={`reward-balance-state${disponible ? '' : ' is-short'}`}>
          {disponible ? '✓ Saldo suficiente' : `Te faltan ${faltan} horas`}
        </span>
        <button type="button" disabled={!disponible} onClick={() => onCanjear(beneficio)}>
          {disponible ? 'Canjear Beneficio' : 'Horas Insuficientes'}
        </button>
      </div>
    </article>
  )
}

export default function Recompensas() {
  const {
    correo,
    horasRecompensas,
    recompensasCargando,
    recompensasError,
  } = useAuth()
  const [mensaje, setMensaje] = useState('')
  const rango = rangoPorHoras(horasRecompensas.acumuladas)
  const siguienteRango = RANGOS_RECOMPENSAS.find((item) => item.nivel === rango.nivel + 1)
  const faltan = siguienteRango ? Math.max(0, siguienteRango.desde - horasRecompensas.acumuladas) : 0
  const progreso = siguienteRango
    ? Math.min(100, ((horasRecompensas.acumuladas - rango.desde) / (siguienteRango.desde - rango.desde)) * 100)
    : 100

  const canjear = (beneficio) => {
    setMensaje(`El canje de “${beneficio.titulo}” aún no está habilitado.`)
  }

  return (
    <div className="rewards-page">
      <section className="rewards-intro">
        <h1>Recompensas &amp; Rango Unimetano</h1>
        <p>Acumula horas de estudio, consulta tu nivel y descubre beneficios exclusivos en el campus.</p>
      </section>

      {recompensasError && (
        <p className="rewards-data-error" role="alert">
          No fue posible consultar tus horas de estudio. Intenta volver a cargar la página.
        </p>
      )}

      <section className="rewards-summary-card" aria-label="Tu rango y progreso">
        <div className="rewards-tree-card">
          <span className="rewards-tree-chip">Horas de estudio</span>
          <span className="rewards-week-chip">Tu nivel: {rango.nivel}</span>
          <ArbolSaman />
          <div className="rewards-tree-copy">
            <h2>Samán en Crecimiento</h2>
            <p>El crecimiento de tu árbol refleja tus sesiones completadas en la biblioteca.</p>
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
              <strong>{horasRecompensas.acumuladas.toFixed(1)} <small>horas</small></strong>
              <span className="rewards-metric-note">Disponibles para beneficios</span>
            </article>
            <article className={`rewards-metric metric-rank rank-${rango.tono}`}>
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
              <span className="rewards-hours-left">
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
      </section>

      <div className="rewards-lower-grid">
        <section className="rewards-catalog" aria-labelledby="rewards-catalog-title">
          <div className="rewards-section-heading">
            <div>
              <h2 id="rewards-catalog-title">Catálogo de Beneficios</h2>
              <span>4 Disponibles</span>
            </div>
            <p>Consulta los beneficios disponibles para canjear tus horas</p>
          </div>
          <div className="rewards-benefit-grid">
            {BENEFICIOS.map((beneficio) => (
              <BeneficioCard
                key={beneficio.titulo}
                beneficio={beneficio}
                saldo={horasRecompensas.acumuladas}
                onCanjear={canjear}
              />
            ))}
          </div>
          <p className="rewards-disclaimer">
            {correo
              ? 'Las horas se suman al completar tus reservas. Los canjes estarán disponibles próximamente.'
              : 'Guarda tu correo institucional para consultar las horas de tus reservas.'}
          </p>
        </section>

        <aside className="rewards-sidebar">
          <section className="rewards-active-benefits">
            <h2>Mis Beneficios en Vigencia</h2>
            <p>Beneficios listos para ser consumidos en tu próxima reserva de cubículo:</p>
            <div className="rewards-empty-benefits">
              Aún no tienes beneficios activos.
            </div>
            <button type="button" disabled>Gestionar pases</button>
          </section>
          <section className="rewards-redemption-history">
            <div className="rewards-history-heading">
              <h2>Historial Reciente de Canje</h2>
              <button type="button" disabled>Ver todo</button>
            </div>
            <p className="rewards-empty-history">Todavía no hay canjes registrados.</p>
            <p className="rewards-history-footnote">Las horas acumuladas se suman al completar tus reservas.</p>
          </section>
        </aside>
      </div>

      <p className="rewards-feedback" role="status" aria-live="polite">{mensaje}</p>
    </div>
  )
}
