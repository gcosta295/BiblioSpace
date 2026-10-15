// Apps Script ligado al spreadsheet (Extensiones > Apps Script).
// Implementar como "Aplicación web": ejecutar como "Yo", acceso "Cualquier persona".
// Ejecutar una vez desde el editor: autorizar() y luego instalarTrigger().
const TZ = 'America/Caracas';
const DOMINIO = '@correo.unimet.edu.ve';
const ADMINS = ['fernando.herrero@correo.unimet.edu.ve']; // completar
const MAX_HORAS = 2;
const APERTURA = 7, CIERRE = 17; // horario de la biblioteca
const MAX_RESERVAS_DIA = 3, MAX_CANCELACIONES_DIA = 3;
const CANCELAR_ANTES_MIN = 15; // se puede cancelar hasta X minutos antes de que empiece
const RECORDATORIO_MIN = 30; // el recordatorio sale cuando faltan X minutos o menos
const CONFIRMAR_MIN = 15; // minutos para confirmar por correo antes de que la reserva expire
const OCUPA = ['Activa', 'Pendiente']; // estados que ocupan el cubículo y a las personas
const MAX_PERSONAS = 6, MIN_PERSONAS = 2;
const COLS_RESERVAS = ['ID_Reserva', 'Fecha', 'Franja_Horaria', 'ID_Cubiculo', 'Correo_Estudiante',
  'Estado', 'Fecha_Creacion', 'Piso', 'Personas', 'Nombre', 'Carnet', 'Miembros', 'Token', 'Vence',
  'Fecha_Cancelacion', 'Recordatorio'];
const COLS_CUBICULOS = ['ID_Cubiculo', 'Piso', 'Capacidad', 'Estado', 'Motivo_Bloqueo'];

// Si la hoja no existe (p. ej. se borró), se crea; headers_ le agrega las columnas.
const sheet_ = (n) => SpreadsheetApp.getActive().getSheetByName(n) || SpreadsheetApp.getActive().insertSheet(n);
const out_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const fail_ = (m) => { throw new Error(m); };
const esAdmin_ = (c) => ADMINS.indexOf(String(c).toLowerCase()) >= 0;
const pad_ = (n) => (n < 10 ? '0' : '') + n;
const ahoraSeg_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
const hoy_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

function headers_(sh, cols) {
  const last = Math.max(sh.getLastColumn(), 1);
  const h = sh.getRange(1, 1, 1, last).getValues()[0].filter(String);
  cols.forEach((c) => {
    if (h.indexOf(c) < 0) { sh.getRange(1, h.length + 1).setValue(c); h.push(c); }
  });
  return h;
}

function read_(name, cols) {
  const sh = sheet_(name), h = headers_(sh, cols);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().map((r, i) => {
    const o = { _fila: i + 2 };
    h.forEach((k, j) => {
      let v = r[j];
      if (v instanceof Date) v = Utilities.formatDate(v, TZ, k === 'Fecha' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss');
      o[k] = v;
    });
    return o;
  });
}

const miembros_ = (r) => String(r.Miembros || '').split(',').map((s) => s.trim().toLowerCase()).filter(String);
const titular_ = (r) => String(r.Correo_Estudiante).toLowerCase();
const esParte_ = (r, correo) => !!correo && (titular_(r) === correo || miembros_(r).indexOf(correo) >= 0);

function doGet(e) {
  try {
    const p = e.parameter;
    if (p.accion === 'perfil') return out_({ status: 'ok', rol: esAdmin_(p.correo) ? 'admin' : 'user' });
    if (p.hoja === 'Cubiculos') return out_(read_('Cubiculos', COLS_CUBICULOS));
    if (p.accion === 'confirmar') return confirmar_(p.token);
    if (p.hoja === 'Reservas') {
      const correo = String(p.correo || '').toLowerCase(), admin = esAdmin_(correo);
      return out_(conLock_(() => {
        expirar_();
        return read_('Reservas', COLS_RESERVAS).map((r) => {
          delete r.Token; // el token nunca sale por la API
          if (admin || esParte_(r, correo)) return r;
          // Los demás solo ven la ocupación, sin datos personales ("Reservado por" es solo para admin)
          r.Correo_Estudiante = ''; r.Nombre = ''; r.Carnet = ''; r.Miembros = '';
          return r;
        });
      }));
    }
    fail_('Hoja no válida');
  } catch (err) { return out_({ status: 'error', mensaje: err.message }); }
}

// Ejecútala una vez desde el editor: fuerza a Google a pedir el permiso de envío de correos.
function autorizar() {
  Logger.log('Correos restantes hoy: ' + MailApp.getRemainingDailyQuota());
}

// Ejecútala una vez: programa la revisión de recordatorios y vencimientos cada 5 minutos.
function instalarTrigger() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'revisarReservas')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('revisarReservas').timeBased().everyMinutes(5).create();
}

function conLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// Las reservas pendientes que no se confirmaron a tiempo dejan de ocupar el cubículo.
function expirar_() {
  const sh = sheet_('Reservas'), col = headers_(sh, COLS_RESERVAS).indexOf('Estado') + 1;
  const ahora = ahoraSeg_();
  read_('Reservas', COLS_RESERVAS).forEach((r) => {
    if (r.Estado === 'Pendiente' && String(r.Vence) < ahora) sh.getRange(r._fila, col).setValue('Expirada');
  });
}

const inicioMs_ = (r) => Utilities.parseDate(r.Fecha + ' ' + String(r.Franja_Horaria).split('-')[0], TZ, 'yyyy-MM-dd HH:mm').getTime();

// Disparada por el trigger: vence pendientes y manda recordatorios de reservas próximas.
function revisarReservas() {
  conLock_(() => {
    expirar_();
    const sh = sheet_('Reservas'), col = headers_(sh, COLS_RESERVAS).indexOf('Recordatorio') + 1;
    const ahora = Date.now();
    read_('Reservas', COLS_RESERVAS).forEach((r) => {
      if (r.Estado !== 'Activa' || r.Recordatorio === 'Si') return;
      const falta = inicioMs_(r) - ahora;
      if (falta <= 0 || falta > RECORDATORIO_MIN * 60000) return;
      try {
        const detalle = detalle_(r.ID_Cubiculo, r.Piso, r.Fecha, r.Franja_Horaria, titular_(r), miembros_(r));
        [titular_(r)].concat(miembros_(r)).forEach((c) =>
          MailApp.sendEmail(c, 'BiblioSpace: recordatorio de tu reserva', 'Tu reserva empieza pronto:\n' + detalle));
        sh.getRange(r._fila, col).setValue('Si');
      } catch (err) { console.error(err); }
    });
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    expirar_();
    const d = JSON.parse(e.postData.contents);
    const correo = String(d.correo || '').toLowerCase();
    if (!correo.endsWith(DOMINIO)) fail_('Solo se permiten correos institucionales (' + DOMINIO + ').');
    const acciones = { crear, cancelar, agregarMiembro, quitarMiembro, bloquear, crearCubiculo };
    if (!acciones[d.accion]) fail_('Acción no válida');
    return out_(Object.assign({ status: 'ok' }, acciones[d.accion](d, correo)));
  } catch (err) {
    return out_({ status: 'error', mensaje: err.message });
  } finally { lock.releaseLock(); }
}

const minutos_ = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const rango_ = (franja) => franja.split('-').map(minutos_);
const ahoraTZ_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); // comparable como texto
const finDe_ = (r) => r.Fecha + ' ' + String(r.Franja_Horaria).split('-')[1];
const mismoCub_ = (c, piso, id) => Number(c.Piso) === Number(piso) && Number(c.ID_Cubiculo) === Number(id);
const capacidad_ = (cub) => Math.min(MAX_PERSONAS, Number(cub.Capacidad));
const buscarCub_ = (piso, id) => read_('Cubiculos', COLS_CUBICULOS).filter((c) => mismoCub_(c, piso, id))[0];

// ¿El correo ya está (como titular o miembro) en una reserva activa que no ha terminado?
function enReserva_(correo, excepto) {
  const ahora = ahoraTZ_();
  return read_('Reservas', COLS_RESERVAS).some((r) => OCUPA.indexOf(r.Estado) >= 0 && r.ID_Reserva !== excepto
    && finDe_(r) > ahora && esParte_(r, correo));
}

function validarMiembro_(m, r, excepto) {
  if (!m.endsWith(DOMINIO)) fail_(m + ': solo correos institucionales.');
  if (m === String(r.titular).toLowerCase()) fail_('El titular ya forma parte de la reserva.');
  if (enReserva_(m, excepto)) fail_(m + ' ya está en otro cubículo.');
}

function crear(d, correo) {
  const piso = Number(d.piso), id = Number(d.cubiculoId);
  const dur = Number(d.duracion), ini = minutos_(d.horaInicio || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || isNaN(ini) || ini % 60) fail_('Fecha u hora de inicio inválida.');
  if (dur !== 1 && dur !== 2 || dur > MAX_HORAS) fail_('La duración máxima es de ' + MAX_HORAS + ' horas.');
  const fin = ini + dur * 60;
  if (ini < APERTURA * 60 || fin > CIERRE * 60) fail_('La biblioteca atiende de ' + APERTURA + ':00 a ' + CIERRE + ':00.');
  const franja = pad_(ini / 60) + ':00-' + pad_(fin / 60) + ':00';
  if (d.fecha + ' ' + pad_(ini / 60) + ':00' < ahoraTZ_().slice(0, 13) + ':00') fail_('No se puede reservar en el pasado.');

  const cub = buscarCub_(piso, id);
  if (!cub) fail_('El cubículo no existe.');
  if (cub.Estado === 'Bloqueado') fail_('El cubículo está bloqueado' + (cub.Motivo_Bloqueo ? ': ' + cub.Motivo_Bloqueo : '.'));

  const miembros = (d.miembros || []).map((m) => String(m).trim().toLowerCase());
  if (miembros.filter((m, i) => miembros.indexOf(m) !== i).length) fail_('Hay miembros repetidos.');
  const personas = 1 + miembros.length;
  if (personas < MIN_PERSONAS) fail_('Se necesitan al menos ' + MIN_PERSONAS + ' personas para reservar.');
  if (personas > capacidad_(cub)) fail_('Máximo ' + capacidad_(cub) + ' personas por cubículo.');
  if (enReserva_(correo)) fail_('Ya estás en una reserva activa. Cancélala para reservar otro cubículo.');
  miembros.forEach((m) => validarMiembro_(m, { titular: correo }));

  const todas = read_('Reservas', COLS_RESERVAS);
  const hoy = hoy_();
  const hechasHoy = todas.filter((r) => titular_(r) === correo && String(r.Fecha_Creacion).slice(0, 10) === hoy
    && r.Estado !== 'Expirada').length;
  if (hechasHoy >= MAX_RESERVAS_DIA) fail_('Alcanzaste el máximo de ' + MAX_RESERVAS_DIA + ' reservas por día.');

  if (todas.filter((r) => OCUPA.indexOf(r.Estado) >= 0).some((r) => {
    if (!mismoCub_(r, piso, r.ID_Cubiculo) || Number(r.ID_Cubiculo) !== id || r.Fecha !== d.fecha) return false;
    const [a, b] = rango_(r.Franja_Horaria);
    return ini < b && a < fin;
  })) fail_('El cubículo ya está reservado en esa franja horaria.');

  const sh = sheet_('Reservas'), h = headers_(sh, COLS_RESERVAS);
  const idRes = 'R' + Date.now(), token = Utilities.getUuid();
  const vence = Utilities.formatDate(new Date(Date.now() + CONFIRMAR_MIN * 60000), TZ, 'yyyy-MM-dd HH:mm:ss');
  const fila = {
    ID_Reserva: idRes, Fecha: d.fecha, Franja_Horaria: franja, ID_Cubiculo: id, Correo_Estudiante: correo,
    Estado: 'Pendiente', Token: token, Vence: vence, Fecha_Creacion: ahoraSeg_(),
    Piso: piso, Personas: personas, Nombre: d.nombre || '', Carnet: d.carnet || '', Miembros: miembros.join(','),
  };
  const n = sh.getLastRow() + 1;
  // Texto plano para que Sheets no convierta fechas ni franjas (y no cambie la zona horaria)
  ['Fecha', 'Franja_Horaria', 'Vence', 'Fecha_Creacion'].forEach((k) => sh.getRange(n, h.indexOf(k) + 1).setNumberFormat('@'));
  sh.getRange(n, 1, 1, h.length).setValues([h.map((k) => (fila[k] === undefined ? '' : fila[k]))]);
  try {
    MailApp.sendEmail(correo, 'BiblioSpace: confirma tu reserva',
      'Hola ' + (d.nombre || '') + ',\n\nPara guardar tu reserva confirma en los próximos ' + CONFIRMAR_MIN
      + ' minutos:\n' + ScriptApp.getService().getUrl() + '?accion=confirmar&token=' + token
      + '\n\n' + detalle_(cub.ID_Cubiculo, cub.Piso, d.fecha, franja, correo, miembros)
      + '\n\nSi no confirmas, la reserva se cancela automáticamente.');
  } catch (err) {
    sh.getRange(n, h.indexOf('Estado') + 1).setValue('Expirada');
    fail_('No se pudo enviar el correo de confirmación (' + err.message + ').');
  }
  return { id: idRes, franja: franja, pendiente: true, minutos: CONFIRMAR_MIN };
}

const detalle_ = (cub, piso, fecha, franja, titular, miembros) =>
  'Cubículo ' + cub + ', piso ' + piso + '\n' + fecha + ', ' + franja + '\nIntegrantes: ' + [titular].concat(miembros).join(', ');

const pagina_ = (titulo, texto) => HtmlService.createHtmlOutput(
  '<meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;max-width:480px;margin:3rem auto;padding:0 1rem">'
  + '<h2>' + titulo + '</h2><p>' + texto + '</p></body>').setTitle('BiblioSpace');

// Enlace del correo: activa la reserva si aún no venció.
function confirmar_(token) {
  return conLock_(() => {
    expirar_();
    const r = token && read_('Reservas', COLS_RESERVAS).filter((x) => x.Estado === 'Pendiente' && x.Token === token)[0];
    if (!r) return pagina_('Enlace no válido o vencido', 'La reserva no se guardó. Vuelve a reservar desde BiblioSpace.');
    const sh = sheet_('Reservas');
    sh.getRange(r._fila, headers_(sh, COLS_RESERVAS).indexOf('Estado') + 1).setValue('Activa');
    const detalle = detalle_(r.ID_Cubiculo, r.Piso, r.Fecha, r.Franja_Horaria, titular_(r), miembros_(r));
    try {
      miembros_(r).forEach((m) => MailApp.sendEmail(m, 'BiblioSpace: te agregaron a un cubículo',
        titular_(r) + ' te agregó a una reserva:\n' + detalle));
    } catch (err) { console.error(err); }
    return pagina_('Reserva confirmada', detalle.split('\n').join('<br>'));
  });
}

function reservaPropia_(d, correo, permitirPendiente) {
  const r = read_('Reservas', COLS_RESERVAS).filter((x) => x.ID_Reserva === d.id)[0];
  if (!r) fail_('Reserva no encontrada.');
  if (titular_(r) !== correo && !esAdmin_(correo)) fail_('No puedes modificar esta reserva.');
  if (r.Estado !== 'Activa' && !(permitirPendiente && r.Estado === 'Pendiente')) fail_('La reserva no está activa. Confírmala desde tu correo.');
  return r;
}

function cancelar(d, correo) {
  const r = reservaPropia_(d, correo, true), sh = sheet_('Reservas'), h = headers_(sh, COLS_RESERVAS);
  const confirmada = r.Estado === 'Activa';
  if (confirmada && !esAdmin_(correo)) {
    if (inicioMs_(r) - Date.now() < CANCELAR_ANTES_MIN * 60000)
      fail_('Solo se puede cancelar hasta ' + CANCELAR_ANTES_MIN + ' minutos antes de que empiece la reserva.');
    const hoy = hoy_();
    const canceladas = read_('Reservas', COLS_RESERVAS)
      .filter((x) => titular_(x) === correo && String(x.Fecha_Cancelacion).slice(0, 10) === hoy).length;
    if (canceladas >= MAX_CANCELACIONES_DIA) fail_('Alcanzaste el máximo de ' + MAX_CANCELACIONES_DIA + ' cancelaciones por día.');
  }
  sh.getRange(r._fila, h.indexOf('Estado') + 1).setValue('Cancelada');
  if (confirmada) sh.getRange(r._fila, h.indexOf('Fecha_Cancelacion') + 1).setNumberFormat('@').setValue(ahoraSeg_());
  try {
    const detalle = detalle_(r.ID_Cubiculo, r.Piso, r.Fecha, r.Franja_Horaria, titular_(r), miembros_(r));
    [titular_(r)].concat(miembros_(r)).forEach((c) =>
      MailApp.sendEmail(c, 'BiblioSpace: reserva cancelada', 'La reserva fue cancelada:\n' + detalle));
  } catch (err) { console.error(err); }
  return {};
}

function guardarMiembros_(r, lista) {
  const sh = sheet_('Reservas'), h = headers_(sh, COLS_RESERVAS);
  sh.getRange(r._fila, h.indexOf('Miembros') + 1).setValue(lista.join(','));
  sh.getRange(r._fila, h.indexOf('Personas') + 1).setValue(1 + lista.length);
}

function agregarMiembro(d, correo) {
  const r = reservaPropia_(d, correo), m = String(d.miembro || '').trim().toLowerCase(), lista = miembros_(r);
  if (lista.indexOf(m) >= 0) fail_('Ya forma parte de esta reserva.');
  validarMiembro_(m, { titular: r.Correo_Estudiante }, r.ID_Reserva);
  const cap = capacidad_(buscarCub_(r.Piso, r.ID_Cubiculo));
  if (lista.length + 2 > cap) fail_('Máximo ' + cap + ' personas por cubículo.');
  guardarMiembros_(r, lista.concat(m));
  return {};
}

function quitarMiembro(d, correo) {
  const r = reservaPropia_(d, correo), m = String(d.miembro || '').trim().toLowerCase(), lista = miembros_(r);
  if (lista.indexOf(m) < 0) fail_('No forma parte de esta reserva.');
  if (lista.length < MIN_PERSONAS) fail_('Se necesitan al menos ' + MIN_PERSONAS + ' personas. Cancela la reserva si ya no la usarán.');
  guardarMiembros_(r, lista.filter((x) => x !== m));
  return {};
}

function bloquear(d, correo) {
  if (!esAdmin_(correo)) fail_('Solo administradores.');
  const cub = buscarCub_(d.piso, d.cubiculoId);
  if (!cub) fail_('El cubículo no existe.');
  const yaBloqueado = cub.Estado === 'Bloqueado';
  if (!!d.bloquear === yaBloqueado) fail_('El cubículo ya está ' + (yaBloqueado ? 'bloqueado.' : 'desbloqueado.'));
  const sh = sheet_('Cubiculos'), h = headers_(sh, COLS_CUBICULOS);
  sh.getRange(cub._fila, h.indexOf('Estado') + 1).setValue(d.bloquear ? 'Bloqueado' : 'Disponible');
  sh.getRange(cub._fila, h.indexOf('Motivo_Bloqueo') + 1).setValue(d.bloquear ? d.motivo || '' : '');
  sheet_('Respuestas_Admin').appendRow([new Date(), correo, d.bloquear ? 'Bloquear' : 'Desbloquear',
    d.cubiculoId, d.piso, cub.Capacidad, d.motivo || '']); // bitácora
  return {};
}

// El ID es el siguiente número libre dentro del piso.
function crearCubiculo(d, correo) {
  if (!esAdmin_(correo)) fail_('Solo administradores.');
  const piso = Number(d.piso), cap = Number(d.capacidad);
  if (!Number.isInteger(piso) || piso < 1) fail_('Piso inválido.');
  if (!Number.isInteger(cap) || cap < 1 || cap > MAX_PERSONAS) fail_('La capacidad debe estar entre 1 y ' + MAX_PERSONAS + '.');
  const ids = read_('Cubiculos', COLS_CUBICULOS).filter((c) => Number(c.Piso) === piso).map((c) => Number(c.ID_Cubiculo));
  const id = ids.length ? Math.max.apply(null, ids) + 1 : 1;
  const sh = sheet_('Cubiculos'), h = headers_(sh, COLS_CUBICULOS);
  const fila = { ID_Cubiculo: id, Piso: piso, Capacidad: cap, Estado: 'Disponible', Motivo_Bloqueo: '' };
  sh.appendRow(h.map((k) => (fila[k] === undefined ? '' : fila[k])));
  sheet_('Respuestas_Admin').appendRow([new Date(), correo, 'Crear', id, piso, cap, '']);
  return { id: id };
}
