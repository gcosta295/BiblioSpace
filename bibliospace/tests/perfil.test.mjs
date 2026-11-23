import assert from 'node:assert/strict'
import test from 'node:test'
import { comprobarFotoPerfil, MAX_FOTO_BYTES, validarDatosPerfil } from '../src/utils/perfil.js'

test('el nombre de usuario admite hasta 12 caracteres', () => {
  assert.equal(validarDatosPerfil('A'.repeat(12), ''), '')
  assert.ok(validarDatosPerfil('A'.repeat(13), ''))
})

test('el teléfono usa +58, guion y diez dígitos sin cero inicial', () => {
  assert.equal(validarDatosPerfil('', '+58-4242789290'), '')
  for (const invalido of ['+58-04242789290', '04242789290', '+58-424278929', '+58-42427892901', '+58-424278929X']) {
    assert.ok(validarDatosPerfil('', invalido))
  }
})

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/B/EAAAAASUVORK5CYII=', 'base64')
const jpeg = Uint8Array.of(255, 216, 255, 224)

test('las extensiones JPG, JPEG y PNG deben corresponder con la firma', async () => {
  for (const ext of ['jpg', 'JPEG']) {
    assert.deepEqual(await comprobarFotoPerfil(new File([jpeg], 'foto.' + ext)), { tipo: 'image/jpeg' })
  }
  assert.deepEqual(await comprobarFotoPerfil(new File([png], 'foto.PNG')), { tipo: 'image/png' })
  for (const file of [new File([png], 'foto.gif'), new File([png], 'foto.jpg'), new File([], 'foto.png')]) {
    assert.ok((await comprobarFotoPerfil(file)).error)
  }
})

test('se acepta exactamente 1 MB y se rechaza un byte adicional', async () => {
  const bytes = new Uint8Array(MAX_FOTO_BYTES + 1)
  bytes.set(png)
  assert.deepEqual(await comprobarFotoPerfil(new File([bytes.subarray(0, MAX_FOTO_BYTES)], 'foto.png')), { tipo: 'image/png' })
  assert.ok((await comprobarFotoPerfil(new File([bytes], 'foto.png'))).error)
})
