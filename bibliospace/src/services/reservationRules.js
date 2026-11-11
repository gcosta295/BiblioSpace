import {
  aHoras,
  hoyISO,
  inicioMs,
  OCUPA,
  reservaVigente,
} from "../utils/time";

const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
const CARNET = /^[1-9][0-9]{10}$/;

// Solo letras y espacios: sin números ni caracteres especiales. -> mensaje de error o null
export function validarNombre(nombre) {
  const n = String(nombre ?? "").trim();
  if (!n) return "Escribe tu nombre completo.";
  if (n.length > 100 || !SOLO_LETRAS.test(n))
    return "El nombre solo puede tener letras y espacios, sin números ni caracteres especiales.";
  return null;
}

// Número positivo de 11 dígitos. -> mensaje de error o null
export function validarCarnet(carnet) {
  const c = String(carnet ?? "").trim();
  if (!c) return "Escribe tu número de carnet.";
  if (!CARNET.test(c))
    return "El carnet debe ser un número positivo de 11 dígitos.";
  return null;
}

export const MAX_PERSONAS = 6;
export const MIN_PERSONAS = 3; // el titular + 2 más
export const DOMINIO1 = "@correo.unimet.edu.ve";
export const DOMINIO2 = "@unimet.edu.ve";
export const APERTURA = 7;
export const CIERRE = 17;
export const MAX_RESERVAS_DIA = 3;
export const CANCELAR_ANTES_MIN = 15;

// Una reserva se puede cancelar hasta 15 min antes de empezar.
export const puedeCancelar = (r) =>
  inicioMs(r) - Date.now() >= CANCELAR_ANTES_MIN * 60000;

const reservasHoy = (reservas, correo) =>
  reservas.filter(
    (r) =>
      String(r.Correo_Estudiante).toLowerCase() === correo &&
      String(r.Fecha_Creacion).slice(0, 10) === hoyISO() &&
      r.Estado !== "Expirada",
  ).length;

export const capacidadDe = (cub) =>
  Math.min(MAX_PERSONAS, Number(cub.Capacidad));

// Espejo de las reglas del backend, para dar errores inmediatos. El backend valida de nuevo.
export function hayConflicto(reservas, cub, fecha, hora, duracion) {
  return reservas.some((r) => {
    if (!OCUPA.includes(r.Estado) || r.Fecha !== fecha) return false;
    if (
      Number(r.Piso) !== Number(cub.Piso) ||
      Number(r.ID_Cubiculo) !== Number(cub.ID_Cubiculo)
    )
      return false;
    const [ini, fin] = aHoras(r.Franja_Horaria);
    return hora < fin && ini < hora + duracion;
  });
}

// Correo institucional (dos dominios) con un usuario que empieza y termina en letra. -> mensaje o null
export function validarCorreoInstitucional(correo) {
  const c = String(correo ?? "").trim().toLowerCase();
  if (!c) return "Escribe tu correo institucional.";
  const esDominioValido = c.endsWith(DOMINIO1) || c.endsWith(DOMINIO2);
  if (!esDominioValido || c.split("@").length !== 2)
    return `Usa un correo institucional (${DOMINIO1} o ${DOMINIO2}).`;
  if (!/^[a-zA-Z](.*[a-zA-Z])?$/.test(c.split("@")[0]))
    return "El usuario del correo debe ser valido.";
  return null;
}

// Contraseña de la cuenta: de 8 a 72 caracteres. -> mensaje o null
export function validarClave(clave) {
  const c = String(clave ?? "");
  if (!c) return "Escribe tu contraseña.";
  if (c.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (c.length > 72) return "La contraseña no puede pasar de 72 caracteres.";
  return null;
}

// Un invitado es válido si es institucional, no está repetido y no está en otro cubículo.
// `actuales` = correos ya en esta reserva (titular incluido). -> mensaje de error o null
export function validarInvitado({ reservas, correo, actuales, cub }) {
  const errorCorreo = validarCorreoInstitucional(correo);
  if (errorCorreo) return errorCorreo;
  if (actuales.includes(correo)) return "Ya forma parte de esta reserva.";
  if (reservaVigente(reservas, correo))
    return `${correo} ya está en otro cubículo.`;
  if (actuales.length + 1 > capacidadDe(cub))
    return `Máximo ${capacidadDe(cub)} personas por cubículo.`;
  return null;
}

// -> mensaje de error o null
export function validarReserva({
  reservas,
  cub,
  correo,
  nombre,
  carnet,
  miembros,
  fecha,
  hora,
  duracion,
  ventana48Restantes = 0,
}) {
  if (!correo)
    return "Inicia sesión para reservar.";
  const errorDatos = validarNombre(nombre) || validarCarnet(carnet);
  if (errorDatos) return errorDatos;
  if (cub.Estado === "Bloqueado") return "El cubículo está bloqueado.";
  if (hora < APERTURA || hora + duracion > CIERRE)
    return `La biblioteca atiende de ${APERTURA}:00 a ${CIERRE}:00.`;
  const inicioReserva = new Date(`${fecha}T${String(hora).padStart(2, "0")}:00:00-04:00`).getTime();
  if (inicioReserva < Date.now())
    return "No se puede reservar en el pasado.";
  const antelacionHoras = (inicioReserva - Date.now()) / 3600000;
  if (antelacionHoras > 48)
    return "Solo puedes reservar con un máximo de 48 horas de antelación.";
  if (antelacionHoras > 24 && ventana48Restantes <= 0)
    return "Solo puedes reservar con 24 horas de antelación. Canjea la ventana extendida para reservar hasta con 48 horas.";
  if (1 + miembros.length < MIN_PERSONAS)
    return `Se necesitan al menos ${MIN_PERSONAS} personas: agrega al menos ${MIN_PERSONAS - 1} integrantes más.`;
  if (1 + miembros.length > capacidadDe(cub))
    return `Máximo ${capacidadDe(cub)} personas por cubículo.`;
  if (reservaVigente(reservas, correo))
    return "Ya estás en una reserva activa. Cancélala para reservar otro cubículo.";
  if (reservasHoy(reservas, correo) >= MAX_RESERVAS_DIA)
    return `Alcanzaste el máximo de ${MAX_RESERVAS_DIA} reservas por día.`;
  if (hayConflicto(reservas, cub, fecha, hora, duracion))
    return "El cubículo ya está reservado en esa franja.";
  return null;
}
