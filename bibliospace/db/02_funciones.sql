-- Ejecutar en Supabase > SQL Editor (después de 01_datos_iniciales.sql). Se puede repetir.
-- La app NO toca las tablas: solo llama a estas funciones, que aplican las reglas de negocio.
-- Zona horaria de la biblioteca: America/Caracas. Horario: 7:00 a 17:00. Capacidad fija: 6 personas.

-- 0) Dos columnas nuevas (no cambian nada de lo existente) para los límites diarios
alter table reservas add column if not exists creada_en timestamptz not null default now();
alter table reservas add column if not exists cancelada_en timestamptz;

-- Seguridad: nadie con la clave pública lee ni escribe las tablas directamente
alter table usuarios enable row level security;
alter table cubiculos enable row level security;
alter table reservas enable row level security;
alter table participantes_reserva enable row level security;
alter table reportes_problemas enable row level security;
alter table log_administrador enable row level security;
revoke all on usuarios, cubiculos, reservas, participantes_reserva, reportes_problemas, log_administrador
  from anon, authenticated;

-- 1) Auxiliares (internas)
create or replace function correo_valido(p text) returns boolean
language sql immutable as $$
  select p ~ '^[^@[:space:]]+@correo\.unimet\.edu\.ve$'
$$;

create or replace function es_admin(p_correo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios
    where correo_institucional = lower(coalesce(p_correo, '')) and rol = 'ADMINISTRADOR'
  )
$$;

-- ¿La persona (titular o integrante) ya está en una reserva vigente que no ha terminado?
create or replace function en_reserva(p_correo text, p_excepto uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from reservas r
    join participantes_reserva p on p.id_reserva = r.id_reserva
    where p.correo_participante = lower(p_correo)
      and r.estado in ('ANTICIPADA', 'ACTIVA')
      and upper(r.rango_horario) > now()
      and r.id_reserva is distinct from p_excepto
  )
$$;

revoke execute on function es_admin(text), en_reserva(text, uuid) from public, anon, authenticated;

-- 2) Lectura
create or replace function perfil(p_correo text) returns text
language sql stable security definer set search_path = public as $$
  select case when es_admin(p_correo) then 'admin' else 'user' end
$$;

create or replace function listar_cubiculos()
returns table (id text, piso int, numero int, estado text, motivo text)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    split_part(c.id, '-', 1)::int,
    split_part(c.id, '-', 2)::int,
    c.estado_ocupacion::text,
    case when c.estado_ocupacion = 'BLOQUEADO' then coalesce((
      select l.motivo from log_administrador l
      where l.id_cubiculo = c.id and l.naturaleza_accion = 'BLOQUEO'
      order by l.marca_tiempo desc limit 1), '') else '' end
  from cubiculos c
  where c.id ~ '^[0-9]+-[0-9]+$'
  order by 2, 3
$$;

-- Todos ven la ocupación; titular e integrantes solo se ven en tus reservas (o todas si eres admin).
create or replace function listar_reservas(p_correo text default '')
returns table (
  id text, id_cubiculo text, piso int, numero int, fecha text, franja text, titular text,
  miembros text[], personas int, estado text, creada_en text, cancelada_en text
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_correo text := lower(coalesce(p_correo, ''));
  v_admin boolean := es_admin(coalesce(p_correo, ''));
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
    case when v.visible then array(
      select p.correo_participante from participantes_reserva p
      where p.id_reserva = r.id_reserva and p.correo_participante <> r.correo_titular
      order by p.correo_participante) else '{}'::text[] end,
    (select count(*)::int from participantes_reserva p where p.id_reserva = r.id_reserva),
    r.estado::text,
    to_char(r.creada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS'),
    coalesce(to_char(r.cancelada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS'), '')
  from reservas r
  cross join lateral (select (
    v_admin or r.correo_titular = v_correo or exists (
      select 1 from participantes_reserva p
      where p.id_reserva = r.id_reserva and p.correo_participante = v_correo)
  ) as visible) v
  order by r.creada_en desc;
end $$;

-- 3) Reservar
create or replace function crear_reserva(
  p_correo text, p_cubiculo text, p_fecha date, p_hora int, p_duracion int,
  p_miembros text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_norm text[];
  v_m text;
  v_inicio timestamptz;
  v_id uuid;
  v_hoy int;
begin
  perform pg_advisory_xact_lock(727001);

  if not correo_valido(v_correo) then
    raise exception 'Solo se permiten correos institucionales (@correo.unimet.edu.ve).';
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
  if 1 + cardinality(v_norm) < 2 then raise exception 'Se necesitan al menos 2 personas para reservar.'; end if;
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

-- 4) Cancelar: hasta 15 min antes de empezar y máximo 3 cancelaciones por día
create or replace function cancelar_reserva(p_correo text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  v_admin boolean;
  v_hoy int;
begin
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

-- 5) Integrantes (mínimo 2, máximo 6)
create or replace function agregar_miembro(p_correo text, p_id uuid, p_miembro text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_m text := lower(trim(p_miembro));
  r reservas%rowtype;
begin
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
  if (select count(*) from participantes_reserva where id_reserva = p_id) >= 6 then
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
  if (select count(*) from participantes_reserva where id_reserva = p_id) <= 2 then
    raise exception 'Se necesitan al menos 2 personas. Cancela la reserva si ya no la usarán.';
  end if;

  delete from participantes_reserva where id_reserva = p_id and correo_participante = v_m;
end $$;

-- 6) Administración
create or replace function bloquear_cubiculo(
  p_correo text, p_cubiculo text, p_bloquear boolean, p_motivo text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_estado estado_ocupacion;
begin
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

-- El número del cubículo es el siguiente libre del piso. Devuelve el id nuevo (ej. '1-7').
create or replace function crear_cubiculo(p_correo text, p_piso int) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_id text;
begin
  if not es_admin(p_correo) then raise exception 'Solo administradores.'; end if;
  if p_piso is null or p_piso < 1 then raise exception 'Piso inválido.'; end if;
  perform pg_advisory_xact_lock(727001);

  select coalesce(max(split_part(id, '-', 2)::int), 0) + 1 into v_n
  from cubiculos where id ~ ('^' || p_piso || '-[0-9]+$');

  v_id := p_piso || '-' || v_n;
  insert into cubiculos (id) values (v_id);
  return v_id;
end $$;

-- 7) Permisos: la app (clave pública) solo puede llamar a estas funciones
grant execute on function
  perfil(text), listar_cubiculos(), listar_reservas(text),
  crear_reserva(text, text, date, int, int, text[]),
  cancelar_reserva(text, uuid),
  agregar_miembro(text, uuid, text), quitar_miembro(text, uuid, text),
  bloquear_cubiculo(text, text, boolean, text), crear_cubiculo(text, int)
to anon, authenticated;
