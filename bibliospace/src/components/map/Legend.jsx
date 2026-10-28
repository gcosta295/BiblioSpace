import { ETIQUETAS } from '../../utils/estados'

export default function Legend() {
  return (
    <ul className="seat-legend">
      {Object.keys(ETIQUETAS).map((e) => (
        <li key={e} className={`seat-legend-item seat-legend-${e}`}>
          <span aria-hidden="true" />
          {ETIQUETAS[e]}
        </li>
      ))}
    </ul>
  )
}
