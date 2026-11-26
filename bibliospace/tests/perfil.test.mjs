import assert from 'node:assert/strict'
import test from 'node:test'
import { comprobarFotoPerfil, MAX_FOTO_BYTES, telefonoParaGuardar, telefonoParaMostrar, validarDatosPerfil } from '../src/utils/perfil.js'

test('el nombre de usuario admite hasta 12 caracteres y no puede ser solo numeros', () => {
  assert.equal(validarDatosPerfil('A'.repeat(12), ''), '')
  assert.equal(validarDatosPerfil('Ana123', ''), '')
  assert.ok(validarDatosPerfil('A'.repeat(13), ''))
  assert.ok(validarDatosPerfil('12345', ''))
  assert.ok(validarDatosPerfil('123 456', ''))
})

test('el perfil solo admite el formato nacional de once digitos sin punto al final del mensaje', () => {
  assert.equal(validarDatosPerfil('', '04248856911'), '')
  assert.equal(validarDatosPerfil('', ''), '')
  for (const invalido of ['+58-4248856911', '4248856911', '0424-8856911', '0424885691', '042488569111', '0424885691X']) {
    const error = validarDatosPerfil('', invalido)
    assert.ok(error)
    assert.equal(error.endsWith('.'), false)
  }
})

test('convierte entre el formato visible y el formato de Supabase', () => {
  assert.equal(telefonoParaMostrar('+58-4248856911'), '04248856911')
  assert.equal(telefonoParaGuardar('04248856911'), '+58-4248856911')
  assert.equal(telefonoParaMostrar(''), '')
  assert.equal(telefonoParaGuardar(''), '')
})

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/B/EAAAAASUVORK5CYII=', 'base64')
const jpeg = Uint8Array.of(255, 216, 255, 224)

test('las extensiones JPG, JPEG y PNG deben corresponder con la firma', async () => {
  for (const ext of ['jpg', 'JPEG']) {
    assert.deepEqual(await comprobarFotoPerfil(new File([jpeg], 'foto.' + ext)), { tipo: 'image/jpeg' })
  }
  assert.deepEqual(await comprobarFotoPerfil(new File([png], 'foto.PNG')), { tipo: 'image/png' })
  for (const file of [new File([png], 'foto.gif'), new File([png], 'foto.jpg'), new File([], 'foto.png'), new File(['%PDF-1.4'], 'documento.pdf')]) {
    assert.ok((await comprobarFotoPerfil(file)).error)
  }
})

test('se acepta exactamente 1 MB y se rechaza un byte adicional', async () => {
  const bytes = new Uint8Array(MAX_FOTO_BYTES + 1)
  bytes.set(png)
  assert.deepEqual(await comprobarFotoPerfil(new File([bytes.subarray(0, MAX_FOTO_BYTES)], 'foto.png')), { tipo: 'image/png' })
  assert.ok((await comprobarFotoPerfil(new File([bytes], 'foto.png'))).error)
})
