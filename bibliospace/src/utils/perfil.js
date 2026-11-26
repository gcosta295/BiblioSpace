export const MAX_FOTO_BYTES = 1_000_000

export const telefonoParaMostrar = (telefono) => telefono.replace(/^\+58-([1-9][0-9]{9})$/, '0$1')

export const telefonoParaGuardar = (telefono) => telefono.replace(/^0([1-9][0-9]{9})$/, '+58-$1')

export function validarDatosPerfil(username, telefono) {
  if ([...username].length > 12) return 'El nombre de usuario admite hasta 12 caracteres.'
  if (username && /^\d+$/.test(username.replace(/\s+/g, ''))) {
    return 'El nombre de usuario no puede estar compuesto solo por números.'
  }
  if (telefono && !/^0[1-9][0-9]{9}$/.test(telefono)) {
    return 'Escribe el número con el formato 04248856911'
  }
  return ''
}

export async function comprobarFotoPerfil(archivo) {
  if (!/\.(png|jpe?g)$/i.test(archivo.name)) {
    return { error: 'No se pudo cargar el archivo. Selecciona una imagen JPG, JPEG o PNG válida.' }
  }
  if (archivo.size > MAX_FOTO_BYTES) return { error: 'No se pudo cargar la foto: no debe pesar más de 1 MB.' }

  const bytes = new Uint8Array(await archivo.slice(0, 8).arrayBuffer())
  const coincide = (firma) => firma.every((byte, indice) => bytes[indice] === byte)
  if (/\.png$/i.test(archivo.name) && coincide([137, 80, 78, 71, 13, 10, 26, 10])) {
    return { tipo: 'image/png' }
  }
  if (/\.jpe?g$/i.test(archivo.name) && coincide([255, 216, 255])) {
    return { tipo: 'image/jpeg' }
  }
  return { error: 'No se pudo cargar el archivo. Selecciona una imagen JPG, JPEG o PNG válida.' }
}
