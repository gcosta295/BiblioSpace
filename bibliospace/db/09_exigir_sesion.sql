-- Ejecutar en Supabase > SQL Editor, después de 08_registro_login.sql. Se puede repetir.
-- Endurecimiento: las funciones dejan de confiar en el correo que manda el navegador.
--
-- !! Ejecutar SOLO cuando el frontend con login ya esté publicado: después de esto, quien no tenga
-- !! sesión iniciada no puede reservar, cancelar, abandonar ni administrar.
--
--   exigir_sesion(p_correo): falla si el correo de la sesión no coincide con p_correo.
--   Las funciones de escritura se recrean con esa comprobación (misma firma) y pasan a requerir sesión.
--   listar_reservas sigue siendo pública (mapa), pero usa el correo de la sesión: sin sesión solo
--   muestra la ocupación, sin datos personales.

create or replace function exigir_sesion(p_correo text) returns void
language plpgsql stable set search_path = public as $$
declare
  v_jwt text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_jwt = '' or v_jwt is distinct from lower(trim(coalesce(p_correo, ''))) then
    raise exception 'Debes iniciar sesión para continuar.';
  end if;
end $$;

revoke execute on function exigir_sesion(text) from public, anon, authenticated;

create or replace function crear_reserva(
  p_correo text, p_cubiculo text, p_fecha date, p_hora int, p_duracion int,
  p_miembros text[] default '{}', p_nombre text default '', p_carnet text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_carnet text := trim(coalesce(p_carnet, ''));
  v_norm text[];
  v_m text;
  v_inicio timestamptz;
  v_id uuid;
  v_hoy int;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);

  if not correo_valido(v_correo) then
    raise exception 'Solo se permiten correos institucionales (@correo.unimet.edu.ve).';
  end if;
  if v_nombre = '' then raise exception 'Escribe tu nombre completo.'; end if;
  if length(v_nombre) > 100 or v_nombre !~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$' then
    raise exception 'El nombre solo puede tener letras y espacios, sin números ni caracteres especiales.';
  end if;
  if v_carnet = '' then raise exception 'Escribe tu número de carnet.'; end if;
  if v_carnet !~ '^[1-9][0-9]{10}$' then
    raise exception 'El carnet debe ser un número positivo de 11 dígitos.';
  end if;
  if p_duracion not in (1, 2) then raise exception 'La duración máxima es de 2 horas.'; end if;
  if p_hora < 7 or p_hora + p_duracion > 17 then
    raise exception 'La biblioteca atiende de 7:00 a 17:00.';
  end if;
  v_inicio := (p_fecha::timestamp + make_interval(hours => p_hora)) at time zone 'America/Caracas';
  if v_inicio < date_trunc('hour', now()) then raise exception 'No se puede reservar en el pasado.'; end if;

  if not exists (select 1 from cubiculos where id = p_cubiculo) then
    raise exception 'El cubículo no existe.';
  end if;
  if exists (select 1 from cubiculos where id = p_cubiculo and estado_ocupacion = 'BLOQUEADO') then
    raise exception 'El cubículo está bloqueado.';
  end if;

  select coalesce(array_agg(lower(trim(x))), '{}') into v_norm from unnest(coalesce(p_miembros, '{}')) x;
  if cardinality(v_norm) <> (select count(distinct m) from unnest(v_norm) m) then
    raise exception 'Hay miembros repetidos.';
  end if;
  if 1 + cardinality(v_norm) < 3 then
    raise exception 'Se necesitan al menos 3 personas para reservar: tú y 2 más.';
  end if;
  if 1 + cardinality(v_norm) > 6 then raise exception 'Máximo 6 personas por cubículo.'; end if;

  if en_reserva(v_correo) then
    raise exception 'Ya estás en una reserva activa. Cancélala para reservar otro cubículo.';
  end if;
  foreach v_m in array v_norm loop
    if not correo_valido(v_m) then raise exception '%: solo correos institucionales.', v_m; end if;
    if v_m = v_correo then raise exception 'El titular ya forma parte de la reserva.'; end if;
    if en_reserva(v_m) then raise exception '% ya está en otro cubículo.', v_m; end if;
  end loop;

  select count(*) into v_hoy from reservas
  where correo_titular = v_correo and estado <> 'EXPIRADA'
    and (creada_en at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
  if v_hoy >= 3 then raise exception 'Alcanzaste el máximo de 3 reservas por día.'; end if;

  insert into usuarios (correo_institucional)
  select c from unnest(array_prepend(v_correo, v_norm)) c
  on conflict do nothing;
  update usuarios set nombre = v_nombre, carnet = v_carnet where correo_institucional = v_correo;

  begin
    insert into reservas (correo_titular, id_cubiculo, hora_inicio, duracion_minutos)
    values (v_correo, p_cubiculo, v_inicio, p_duracion * 60)
    returning id_reserva into v_id; -- el trigger agrega al titular como participante
  exception when exclusion_violation then
    raise exception 'El cubículo ya está reservado en esa franja horaria.';
  end;

  insert into participantes_reserva (id_reserva, correo_participante)
  select v_id, m from unnest(v_norm) m
  on conflict do nothing;

  return jsonb_build_object(
    'id', v_id,
    'franja', lpad(p_hora::text, 2, '0') || ':00-' || lpad((p_hora + p_duracion)::text, 2, '0') || ':00'
  );
end $$;

create or replace function cancelar_reserva(p_correo text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  v_admin boolean;
  v_hoy int;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);
  select * into r from reservas where id_reserva = p_id;
  if not found then raise exception 'Reserva no encontrada.'; end if;

  v_admin := es_admin(v_correo);
  if r.correo_titular <> v_correo and not v_admin then
    raise exception 'No puedes modificar esta reserva.';
  end if;
  if r.estado = 'ACTIVA' then raise exception 'La reserva ya está en uso y no se puede cancelar.'; end if;
  if r.estado <> 'ANTICIPADA' then raise exception 'La reserva no está activa.'; end if;

  if not v_admin then
    if now() > r.hora_inicio - interval '15 minutes' then
      raise exception 'Solo se puede cancelar hasta 15 minutos antes de que empiece la reserva.';
    end if;
    select count(*) into v_hoy from reservas
    where correo_titular = v_correo and cancelada_en is not null
      and (cancelada_en at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
    if v_hoy >= 3 then raise exception 'Alcanzaste el máximo de 3 cancelaciones por día.'; end if;
  end if;

  update reservas set estado = 'CANCELADA', cancelada_en = now() where id_reserva = p_id;
end $$;

create or replace function abandonar_reserva(p_correo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  v_resto int;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);

  select * into r from reservas where id_reserva = p_id;
  if not found then raise exception 'Reserva no encontrada.'; end if;
  if r.estado not in ('ANTICIPADA', 'ACTIVA') then raise exception 'La reserva no está activa.'; end if;
  if not exists (
    select 1 from participantes_reserva where id_reserva = p_id and correo_participante = v_correo
  ) then
    raise exception 'No formas parte de esta reserva.';
  end if;

  if r.estado = 'ACTIVA' then
    update participantes_reserva set activo_en_cubiculo = false
    where id_reserva = p_id and correo_participante = v_correo;
    return jsonb_build_object('cancelada', false, 'mensaje', 'Has salido del cubículo.');
  end if;

  if r.correo_titular = v_correo then
    perform cancelar_reserva(v_correo, p_id);
    return jsonb_build_object('cancelada', true, 'mensaje', 'Reserva cancelada.');
  end if;

  delete from participantes_reserva where id_reserva = p_id and correo_participante = v_correo;
  select count(*) into v_resto from participantes_reserva where id_reserva = p_id;
  if v_resto < 3 then
    update reservas set estado = 'CANCELADA' where id_reserva = p_id;
    return jsonb_build_object(
      'cancelada', true,
      'mensaje', 'La reserva se canceló porque quedaron menos de 3 personas.'
    );
  end if;

  return jsonb_build_object('cancelada', false, 'mensaje', 'Has abandonado el cubículo correctamente.');
end $$;

create or replace function agregar_miembro(p_correo text, p_id uuid, p_miembro text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_m text := lower(trim(p_miembro));
  r reservas%rowtype;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);
  select * into r from reservas where id_reserva = p_id;
  if not found then raise exception 'Reserva no encontrada.'; end if;
  if r.correo_titular <> v_correo and not es_admin(v_correo) then
    raise exception 'No puedes modificar esta reserva.';
  end if;
  if r.estado <> 'ANTICIPADA' then raise exception 'La reserva no está activa.'; end if;

  if not correo_valido(v_m) then raise exception '%: solo correos institucionales.', v_m; end if;
  if exists (select 1 from participantes_reserva where id_reserva = p_id and correo_participante = v_m) then
    raise exception 'Ya forma parte de esta reserva.';
  end if;
  if en_reserva(v_m, p_id) then raise exception '% ya está en otro cubículo.', v_m; end if;
  if (select count(*) from participantes_reserva where id_reserva = p_id) > 5 then
    raise exception 'Máximo 6 personas por cubículo.';
  end if;

  insert into usuarios (correo_institucional) values (v_m) on conflict do nothing;
  insert into participantes_reserva (id_reserva, correo_participante) values (p_id, v_m);
end $$;

create or replace function quitar_miembro(p_correo text, p_id uuid, p_miembro text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_m text := lower(trim(p_miembro));
  r reservas%rowtype;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);
  select * into r from reservas where id_reserva = p_id;
  if not found then raise exception 'Reserva no encontrada.'; end if;
  if r.correo_titular <> v_correo and not es_admin(v_correo) then
    raise exception 'No puedes modificar esta reserva.';
  end if;
  if r.estado <> 'ANTICIPADA' then raise exception 'La reserva no está activa.'; end if;

  if v_m = r.correo_titular then raise exception 'El titular no puede quitarse de su reserva.'; end if;
  if not exists (select 1 from participantes_reserva where id_reserva = p_id and correo_participante = v_m) then
    raise exception 'No forma parte de esta reserva.';
  end if;
  if (select count(*) from participantes_reserva where id_reserva = p_id) <= 3 then
    raise exception 'Se necesitan al menos 3 personas. Cancela la reserva si ya no la usarán.';
  end if;

  delete from participantes_reserva where id_reserva = p_id and correo_participante = v_m;
end $$;

create or replace function bloquear_cubiculo(
  p_correo text, p_cubiculo text, p_bloquear boolean, p_motivo text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_estado estado_ocupacion;
begin
  perform exigir_sesion(p_correo);
  if not es_admin(v_correo) then raise exception 'Solo administradores.'; end if;
  perform pg_advisory_xact_lock(727001);

  select estado_ocupacion into v_estado from cubiculos where id = p_cubiculo;
  if not found then raise exception 'El cubículo no existe.'; end if;
  if p_bloquear and v_estado = 'BLOQUEADO' then raise exception 'El cubículo ya está bloqueado.'; end if;
  if not p_bloquear and v_estado <> 'BLOQUEADO' then raise exception 'El cubículo ya está desbloqueado.'; end if;
  if p_bloquear and v_estado = 'RESERVADO' then raise exception 'El cubículo está en uso en este momento.'; end if;

  update cubiculos
  set estado_ocupacion = (case when p_bloquear then 'BLOQUEADO' else 'DISPONIBLE' end)::estado_ocupacion,
      ultima_actualizacion = now()
  where id = p_cubiculo;

  insert into log_administrador (id_cubiculo, naturaleza_accion, correo_admin, motivo)
  values (p_cubiculo, (case when p_bloquear then 'BLOQUEO' else 'HABILITACION' end)::naturaleza_accion,
          v_correo, coalesce(p_motivo, ''));
end $$;

create or replace function crear_cubiculo(p_correo text, p_piso int) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_id text;
begin
  perform exigir_sesion(p_correo);
  if not es_admin(p_correo) then raise exception 'Solo administradores.'; end if;
  if p_piso is null or p_piso < 1 then raise exception 'Piso inválido.'; end if;
  perform pg_advisory_xact_lock(727001);

  select coalesce(max(split_part(id, '-', 2)::int), 0) + 1 into v_n
  from cubiculos where id ~ ('^' || p_piso || '-[0-9]+$');

  v_id := p_piso || '-' || v_n;
  insert into cubiculos (id) values (v_id);
  return v_id;
end $$;

create or replace function liberar_cubiculo(
  p_correo text, p_cubiculo text, p_motivo text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_estado estado_ocupacion;
  v_reserva reservas%rowtype;
  v_ocupantes text[];
begin
  perform exigir_sesion(p_correo);
  if not es_admin(v_correo) then raise exception 'Solo administradores.'; end if;
  if v_motivo = '' then raise exception 'Escribe el motivo de la liberación.'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es demasiado largo.'; end if;

  perform pg_advisory_xact_lock(727001);

  select estado_ocupacion into v_estado from cubiculos where id = p_cubiculo;
  if not found then raise exception 'El cubículo no existe.'; end if;

  -- Criterio 2: bloqueado no se libera; se desbloquea desde la acción de bloqueo.
  if v_estado = 'BLOQUEADO' then
    raise exception 'El cubículo está bloqueado. Desbloquéalo en vez de liberarlo.';
  end if;

  -- La reserva que lo está ocupando ahora mismo.
  select * into v_reserva
  from reservas
  where id_cubiculo = p_cubiculo
    and estado in ('ANTICIPADA', 'ACTIVA')
    and rango_horario @> now()
  order by hora_inicio
  limit 1;

  -- Criterio 1: si no hay nadie dentro, no hay nada que liberar.
  if not found then
    raise exception 'El cubículo está libre: no hay ninguna reserva en curso.';
  end if;

  -- Criterio 4: se guardan los ocupantes ANTES de expulsarlos, porque después ya no están.
  select coalesce(array_agg(correo_participante order by correo_participante), '{}')
  into v_ocupantes
  from participantes_reserva
  where id_reserva = v_reserva.id_reserva;

  -- Criterio 3: primero se expulsa a los miembros, después se libera el cubículo.
  delete from participantes_reserva where id_reserva = v_reserva.id_reserva;

  update reservas
  set estado = 'CANCELADA', cancelada_en = now()
  where id_reserva = v_reserva.id_reserva;

  update cubiculos
  set estado_ocupacion = 'DISPONIBLE', ultima_actualizacion = now()
  where id = p_cubiculo;

  insert into log_administrador (id_cubiculo, naturaleza_accion, correo_admin, motivo, id_reserva, ocupantes)
  values (p_cubiculo, 'LIBERACION', v_correo, v_motivo, v_reserva.id_reserva, v_ocupantes);

  return jsonb_build_object(
    'cubiculo', p_cubiculo,
    'id_reserva', v_reserva.id_reserva,
    'ocupantes', to_jsonb(v_ocupantes),
    'personas', cardinality(v_ocupantes)
  );
end $$;

create or replace function listar_log_admin(p_correo text, p_limite int default 20)
returns table (
  id_cubiculo text, accion text, correo_admin text, motivo text,
  ocupantes text[], marca_tiempo text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_sesion(p_correo);
  if not es_admin(coalesce(p_correo, '')) then raise exception 'Solo administradores.'; end if;

  return query
  select
    l.id_cubiculo,
    l.naturaleza_accion::text,
    l.correo_admin,
    coalesce(l.motivo, ''),
    coalesce(l.ocupantes, '{}'::text[]),
    to_char(l.marca_tiempo at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS')
  from log_administrador l
  order by l.marca_tiempo desc
  limit greatest(1, least(coalesce(p_limite, 20), 100));
end $$;

create or replace function listar_reservas(p_correo text default '')
returns table (
  id text, id_cubiculo text, piso int, numero int, fecha text, franja text, titular text,
  nombre text, carnet text, miembros text[], personas int, estado text, creada_en text, cancelada_en text
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', '')); -- ignora p_correo: manda la sesión
  v_admin boolean := es_admin(v_correo);
begin
  return query
  select
    r.id_reserva::text,
    r.id_cubiculo,
    split_part(r.id_cubiculo, '-', 1)::int,
    split_part(r.id_cubiculo, '-', 2)::int,
    to_char(r.hora_inicio at time zone 'America/Caracas', 'YYYY-MM-DD'),
    to_char(r.hora_inicio at time zone 'America/Caracas', 'HH24:MI') || '-'
      || to_char(upper(r.rango_horario) at time zone 'America/Caracas', 'HH24:MI'),
    case when v.visible then r.correo_titular else '' end,
    case when v.visible then coalesce(u.nombre, '') else '' end,
    case when v_admin or r.correo_titular = v_correo then coalesce(u.carnet, '') else '' end,
    case when v.visible then array(
      select p.correo_participante from participantes_reserva p
      where p.id_reserva = r.id_reserva and p.correo_participante <> r.correo_titular
      order by p.correo_participante) else '{}'::text[] end,
    (select count(*)::int from participantes_reserva p where p.id_reserva = r.id_reserva),
    r.estado::text,
    to_char(r.creada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS'),
    coalesce(to_char(r.cancelada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS'), '')
  from reservas r
  left join usuarios u on u.correo_institucional = r.correo_titular
  cross join lateral (select (
    v_admin or r.correo_titular = v_correo or exists (
      select 1 from participantes_reserva p
      where p.id_reserva = r.id_reserva and p.correo_participante = v_correo)
  ) as visible) v
  order by r.creada_en desc;
end $$;

-- Permisos: escribir solo con sesión; el mapa (cubículos y ocupación) sigue público
revoke execute on function
  crear_reserva(text, text, date, int, int, text[], text, text),
  cancelar_reserva(text, uuid),
  abandonar_reserva(text, uuid),
  agregar_miembro(text, uuid, text),
  quitar_miembro(text, uuid, text),
  bloquear_cubiculo(text, text, boolean, text),
  crear_cubiculo(text, int),
  liberar_cubiculo(text, text, text),
  listar_log_admin(text, int),
  perfil(text)
from public, anon;

grant execute on function
  crear_reserva(text, text, date, int, int, text[], text, text),
  cancelar_reserva(text, uuid),
  abandonar_reserva(text, uuid),
  agregar_miembro(text, uuid, text),
  quitar_miembro(text, uuid, text),
  bloquear_cubiculo(text, text, boolean, text),
  crear_cubiculo(text, int),
  liberar_cubiculo(text, text, text),
  listar_log_admin(text, int),
  perfil(text)
to authenticated;

grant execute on function listar_cubiculos(), listar_reservas(text), correo_registrado(text)
to anon, authenticated;
