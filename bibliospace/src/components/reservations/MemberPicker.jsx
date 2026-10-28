import { useId, useState } from 'react'

// Lista de integrantes con campo de lista desplegable (datalist) para invitar conocidos.
// onAdd / onRemove pueden ser async y devuelven un mensaje de error o null.
export default function MemberPicker({
  titular,
  titularLabel = titular,
  titularSuffix = 'titular',
  miembros,
  sugerencias,
  onAdd,
  onRemove,
  readOnly = false,
  className = '',
}) {
  const listId = useId()
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = async (fn) => {
    setOcupado(true)
    const err = await fn()
    setOcupado(false)
    setError(err || '')
    return !err
  }

  const agregar = async () => {
    const correo = valor.trim().toLowerCase()
    if (correo && (await ejecutar(() => onAdd(correo)))) setValor('')
  }

  const disponibles = sugerencias.filter((s) => s !== titular && !miembros.includes(s))

  return (
    <div className={`member-picker space-y-2 ${className}`}>
      <ul className="space-y-1 text-sm">
        <li className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-1.5">
          <span className="truncate" title={titularLabel}>{titularLabel}</span>
          <span className="ml-2 text-xs text-slate-500">{titularSuffix}</span>
        </li>
        {miembros.map((m) => (
          <li key={m} className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-1.5">
            <span className="truncate" title={m}>{m}</span>
            {!readOnly && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => ejecutar(() => onRemove(m))}
                className="ml-2 text-red-600 disabled:opacity-40"
                aria-label={`Quitar ${m}`}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex gap-2">
          <input
            list={listId}
            type="email"
            aria-label="Correo institucional del integrante"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregar()
              }
            }}
            placeholder="Añadir por correo unimet..."
            className="member-picker-input min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id={listId}>
            {disponibles.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            type="button"
            disabled={ocupado}
            onClick={agregar}
            className="member-picker-add rounded-md bg-slate-800 px-3 text-sm text-white disabled:opacity-50"
            aria-label="Añadir integrante"
          >
            {ocupado ? '…' : '+'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
