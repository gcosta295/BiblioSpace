-- Ejecutar en Supabase > SQL Editor, después de 02_funciones.sql.
-- Agrega nombre y carnet a `usuarios` y actualiza las dos funciones que los usan:
--   crear_reserva  -> ahora exige y guarda el nombre y el carnet del titular
--   listar_reservas -> devuelve el nombre (a participantes y admin) y el carnet (solo al titular y al admin)

alter table usuarios add column if not exists nombre text not null default '';
alter table usuarios add column if not exists carnet text not null default '';

-- Cambia la firma / el tipo de retorno, así que hay que borrarlas primero (esto quita sus permisos).
drop function if exists crear_reserva(text, text, date, int, int, text[]);
drop function if exists listar_reservas(text);

create or replace function listar_reservas(p_correo text default '')
returns table (
  id text, id_cubiculo text, piso int, numero int, fecha text, franja text, titular text,
  nombre text, carnet text, miembros text[], personas int, estado text, creada_en text, cancelada_en text
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

grant execute on function
  listar_reservas(text),
  crear_reserva(text, text, date, int, int, text[], text, text)
to anon, authenticated;
