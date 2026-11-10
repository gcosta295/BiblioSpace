import logoMarca from '../../assets/logo-footer.png'

// Cabecera de las pantallas de acceso: solo el ícono del logo (recortado del logo completo),
// el nombre y el lema. El banner y el pie de la página son los del resto de la app (Layout).
export default function AuthBrand() {
  return (
    <div className="auth-brand">
      <span className="auth-logo" aria-hidden="true">
        <img src={logoMarca} alt="" />
      </span>
      <h1 className="auth-title">BiblioSpace</h1>
      <p className="auth-kicker">Biblioteca Universidad Metropolitana</p>
      <p className="auth-subtitle">Gestión de acceso y reserva inteligente de cubículos</p>
    </div>
  )
}
