-- Ejecutar en Supabase > SQL Editor, después de 05_abandonar_reserva.sql. Se puede repetir.
-- Cambio de regla: una reserva necesita MÍNIMO 3 personas (el titular + 2 más). Antes eran 2.
--   crear_reserva  -> exige titular + al menos 2 integrantes
--   quitar_miembro -> no deja bajar de 3 personas (abandonar_reserva ya cancela si quedan menos de 3)
-- Las reservas que ya existían con 2 personas no se tocan.

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
  perform pg_advisory_xact_lock(727001);

  if not correo_valido(v_correo) then
    raise exception 'Solo se permiten correos institucionales (@correo.unimet.edu.ve).';
  end if;
  if v_nombre = '' then raise exception 'Escribe tu nombre completo.'; end if;
  if v_carnet = '' then raise exception 'Escribe tu número de carnet.'; end if;
  if length(v_nombre) > 100 or length(v_carnet) > 20 then
    raise exception 'El nombre o el carnet son demasiado largos.';
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
  if (select count(*) from participantes_reserva where id_reserva = p_id) <= 3 then
    raise exception 'Se necesitan al menos 3 personas. Cancela la reserva si ya no la usarán.';
  end if;

  delete from participantes_reserva where id_reserva = p_id and correo_participante = v_m;
end $$;
