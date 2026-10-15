// Cliente del Web App de Apps Script (ver backend/Code.gs)
const SCRIPT_URL = import.meta.env.VITE_SHEETS_API_URL;

const get = async (params, fallback) => {
  try {
    const response = await fetch(`${SCRIPT_URL}?${new URLSearchParams(params)}`);
    return await response.json();
  } catch (error) {
    console.error("Error de lectura:", error);
    return fallback;
  }
};

// Body como text/plain (sin Content-Type) evita el preflight de CORS con Apps Script
const post = async (datos) => {
  try {
    const response = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(datos) });
    return await response.json();
  } catch (error) {
    console.error("Error de escritura:", error);
    return { status: "error", mensaje: "Error de conexión con el servidor." };
  }
};

export const obtenerCubiculos = () => get({ hoja: "Cubiculos" }, []);
// Con el correo, el servidor devuelve los datos personales solo de tus reservas (o de todas si eres admin)
export const obtenerReservas = (correo = "") => get({ hoja: "Reservas", correo }, []);

// -> { status: 'ok', rol: 'admin' | 'user' }
export const obtenerPerfil = (correo) => get({ accion: "perfil", correo }, { status: "error" });

// { correo, piso, cubiculoId, fecha: 'YYYY-MM-DD', horaInicio: 'HH:00', duracion: 1|2, miembros: [correos], nombre, carnet }
export const crearReserva = (datos) => post({ accion: "crear", ...datos });

export const cancelarReserva = (correo, id) => post({ accion: "cancelar", correo, id });

export const agregarMiembro = (correo, id, miembro) => post({ accion: "agregarMiembro", correo, id, miembro });

export const quitarMiembro = (correo, id, miembro) => post({ accion: "quitarMiembro", correo, id, miembro });

// Solo admin: el ID del cubículo se asigna solo (siguiente número libre del piso)
export const crearCubiculo = (correo, piso, capacidad) => post({ accion: "crearCubiculo", correo, piso, capacidad });

// Solo admin: bloquear = true | false
export const bloquearCubiculo = (correo, piso, cubiculoId, bloquear, motivo = "") =>
  post({ accion: "bloquear", correo, piso, cubiculoId, bloquear, motivo });
