import { useState } from 'react'
import { liberarCubiculo } from '../../api/library'

// Liberación manual de un cubículo en uso (solo admin).
// Son dos pasos a propósito: en una tabla de cubículos casi idénticos es fácil
// pulsar la fila equivocada, así que el segundo paso pide escribir el número.
export default function ReleaseDialog({ cub, reserva, correo, onClose, onReleased, onError }) {
  const [paso, setPaso] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)

  const numero = String(cub.ID_Cubiculo)
  const motivoListo = motivo.trim().length > 0
  const numeroListo = confirmacion.trim() === numero

  const ocupantes = [
    String(reserva?.Correo_Estudiante || '').toLowerCase(),
    ...String(reserva?.Miembros || '')
      .split(',')
      .map((m) => m.trim().toLowerCase()),
  ].filter(Boolean)

  const liberar = async () => {
    setEnviando(true)
    const res = await liberarCubiculo(correo, cub.Piso, cub.ID_Cubiculo, motivo.trim())
    setEnviando(false)
    if (res.status === 'ok') {
      const personas = res.personas ?? ocupantes.length
      onReleased(
        `Cubículo ${numero} (piso ${cub.Piso}) liberado. ` +
          `${personas} ${personas === 1 ? 'persona fue expulsada' : 'personas fueron expulsadas'} de la reserva.`,
      )
    } else {
      onError(res.mensaje || 'No se pudo liberar el cubículo.')
      onClose()
    }
  }

  return (
    <div className="admin-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-dialog-header">
          <span className="admin-dialog-step">Paso {paso} de 2</span>
          <h2 id="release-title">
            {paso === 1 ? 'Liberar cubículo' : '¿Seguro que quieres liberarlo?'}
          </h2>
        </header>

        {paso === 1 ? (
          <div className="admin-dialog-body">
            <dl className="admin-dialog-summary">
              <div>
                <dt>Cubículo</dt>
                <dd>
                  {numero} · Piso {cub.Piso}
                </dd>
              </div>
              <div>
                <dt>Turno</dt>
                <dd>{reserva?.Franja_Horaria || '—'}</dd>
              </div>
              <div>
                <dt>Ocupantes</dt>
                <dd>{ocupantes.length}</dd>
              </div>
            </dl>

            {ocupantes.length > 0 && (
              <ul className="admin-dialog-people">
                {ocupantes.map((persona) => (
                  <li key={persona}>{persona}</li>
                ))}
              </ul>
            )}

            <label className="admin-form-field">
              <span>Motivo de la liberación</span>
              <textarea
                autoFocus
                rows={3}
                value={motivo}
                maxLength={300}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Ej: el grupo dejó el cubículo sin cerrar su reserva."
              />
            </label>
            <p className="admin-dialog-help">
              Queda guardado en el log junto con tu correo y los ocupantes.
            </p>
          </div>
        ) : (
          <div className="admin-dialog-body">
            <p className="admin-dialog-warning">
              Se va a cancelar la reserva del cubículo <strong>{numero}</strong> (piso {cub.Piso}) y se
              expulsará a <strong>{ocupantes.length}</strong>{' '}
              {ocupantes.length === 1 ? 'persona' : 'personas'}. Esto no se puede deshacer.
            </p>
            <label className="admin-form-field">
              <span>Escribe el número del cubículo ({numero}) para confirmar</span>
              <input
                autoFocus
                value={confirmacion}
                inputMode="numeric"
                onChange={(event) => setConfirmacion(event.target.value)}
                aria-label={`Escribe ${numero} para confirmar la liberación`}
              />
            </label>
          </div>
        )}

        <footer className="admin-dialog-actions">
          <button type="button" className="admin-dialog-ghost" onClick={paso === 1 ? onClose : () => setPaso(1)}>
            {paso === 1 ? 'Cancelar' : 'Volver'}
          </button>
          {paso === 1 ? (
            <button
              type="button"
              className="admin-dialog-primary"
              disabled={!motivoListo}
              onClick={() => setPaso(2)}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="admin-dialog-danger"
              disabled={!numeroListo || enviando}
              onClick={liberar}
            >
              {enviando ? 'Liberando…' : 'Liberar cubículo'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
