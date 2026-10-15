import { COLORES, ETIQUETAS } from '../../utils/estados'

export default function Legend() {
  return (
    <ul className="flex flex-wrap gap-3 text-sm">
      {Object.keys(ETIQUETAS).map((e) => (
        <li key={e} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded border ${COLORES[e].split(' hover')[0]}`} />
          {ETIQUETAS[e]}
        </li>
      ))}
    </ul>
  )
}
