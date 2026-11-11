-- Ejecutar en Supabase > SQL Editor, después de 09_exigir_sesion.sql. Se puede repetir.
-- HU: como usuario quiero tener un apartado de notificaciones.
--
-- Criterios de aceptación de la tarjeta:
--   1. El usuario solo ve notificaciones de sus propias reservas, nunca las de otros.
--   2. Al abrir el apartado el contador vuelve a cero y no reaparece al recargar la página.
--   3. Si un admin lo expulsa de un cubículo, le queda una notificación con el cubículo,
--      la hora y el motivo.
--
-- Cómo funciona: las notificaciones NO se guardan una por una. Se calculan a partir de lo que
-- ya está en la base (reservas y log_administrador). Lo único que se guarda es cuándo las vio
-- el usuario por última vez, y con eso se sabe cuáles están sin leer. Así no hay una tabla
-- paralela que mantener al día, y el contador funciona igual en el teléfono y en la laptop.

-- 1) Criterio 2: la marca de "visto hasta aquí"
alter table usuarios add column if not exists notificaciones_vistas_en timestamptz;

-- 2) Criterio 1: la lista se arma con el correo de la SESIÓN, no con uno que mande el navegador.
--    Aunque alguien llame la función a mano con otro correo, solo recibe lo suyo.
create or replace function listar_notificaciones(p_limite int default 30)
returns table (
  id text, tipo text, titulo text, detalle text,
  id_cubiculo text, piso int, numero int,
  marca_tiempo text, no_leida boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_visto timestamptz;
begin
  if v_correo = '' then raise exception 'Debes iniciar sesión para continuar.'; end if;

  select u.notificaciones_vistas_en into v_visto
  from usuarios u where u.correo_institucional = v_correo;

  return query
  with mias as (
    -- Reservas donde el usuario es el titular o uno de los integrantes.
    select r.* from reservas r
    where r.correo_titular = v_correo
       or exists (
         select 1 from participantes_reserva p
         where p.id_reserva = r.id_reserva and p.correo_participante = v_correo
       )
  ),
  expulsiones as (
    -- Cuando un admin libera un cubículo, borra las filas de participantes. Por eso la
    -- expulsión no se puede leer desde `mias`: sale del log, que sí guarda los ocupantes.
    select l.id_cubiculo, l.id_reserva, l.motivo, l.marca_tiempo
    from log_administrador l
    where l.naturaleza_accion = 'LIBERACION' and v_correo = any(coalesce(l.ocupantes, '{}'::text[]))
  ),
  eventos as (
    -- Reserva creada
    select
      m.id_reserva::text || ':creada' as ev_id,
      'RESERVA_CREADA' as ev_tipo,
      (case when m.correo_titular = v_correo then 'Reserva confirmada'
            else 'Te agregaron a una reserva' end) as ev_titulo,
      (case when m.correo_titular = v_correo then 'Reservaste el ' else 'Te sumaron al ' end)
        || 'cubículo ' || split_part(m.id_cubiculo, '-', 2)
        || ' del piso ' || split_part(m.id_cubiculo, '-', 1)
        || ' para el ' || to_char(m.hora_inicio at time zone 'America/Caracas', 'DD/MM')
        || ' a las ' || to_char(m.hora_inicio at time zone 'America/Caracas', 'HH24:MI') || '.' as ev_detalle,
      m.id_cubiculo as ev_cubiculo,
      m.creada_en as ev_cuando
    from mias m

    union all

    -- Reserva cancelada. Se dejan fuera las que se cancelaron porque un admin liberó el
    -- cubículo: esas ya tienen su propia notificación, más completa, unas líneas más abajo.
    select
      m.id_reserva::text || ':cancelada',
      'RESERVA_CANCELADA',
      'Reserva cancelada',
      'Se canceló tu reserva del cubículo ' || split_part(m.id_cubiculo, '-', 2)
        || ' del piso ' || split_part(m.id_cubiculo, '-', 1)
        || ' del ' || to_char(m.hora_inicio at time zone 'America/Caracas', 'DD/MM') || '.',
      m.id_cubiculo,
      m.cancelada_en
    from mias m
    where m.estado = 'CANCELADA' and m.cancelada_en is not null
      and not exists (select 1 from expulsiones e where e.id_reserva = m.id_reserva)

    union all

    -- Reserva terminada
    select
      m.id_reserva::text || ':completada',
      'RESERVA_COMPLETADA',
      'Reserva finalizada',
      'Terminó tu turno en el cubículo ' || split_part(m.id_cubiculo, '-', 2)
        || ' del piso ' || split_part(m.id_cubiculo, '-', 1) || '.',
      m.id_cubiculo,
      upper(m.rango_horario)
    from mias m
    where m.estado = 'COMPLETADA'

    union all

    -- Reserva que venció sin usarse
    select
      m.id_reserva::text || ':expirada',
      'RESERVA_EXPIRADA',
      'Reserva expirada',
      'Tu reserva del cubículo ' || split_part(m.id_cubiculo, '-', 2)
        || ' del piso ' || split_part(m.id_cubiculo, '-', 1) || ' venció sin usarse.',
      m.id_cubiculo,
      upper(m.rango_horario)
    from mias m
    where m.estado = 'EXPIRADA'

    union all

    -- Criterio 3: expulsión por un administrador, con cubículo, hora y motivo
    select
      'liberacion:' || e.id_cubiculo || ':'
        || to_char(e.marca_tiempo at time zone 'America/Caracas', 'YYYYMMDDHH24MISSUS'),
      'LIBERACION',
      'Un administrador liberó tu cubículo',
      'Te sacaron del cubículo ' || split_part(e.id_cubiculo, '-', 2)
        || ' del piso ' || split_part(e.id_cubiculo, '-', 1)
        || ' el ' || to_char(e.marca_tiempo at time zone 'America/Caracas', 'DD/MM')
        || ' a las ' || to_char(e.marca_tiempo at time zone 'America/Caracas', 'HH24:MI')
        || '. Motivo: ' || coalesce(nullif(trim(e.motivo), ''), 'no indicado') || '.',
      e.id_cubiculo,
      e.marca_tiempo
    from expulsiones e
  )
  select
    v.ev_id,
    v.ev_tipo,
    v.ev_titulo,
    v.ev_detalle,
    v.ev_cubiculo,
    split_part(v.ev_cubiculo, '-', 1)::int,
    split_part(v.ev_cubiculo, '-', 2)::int,
    to_char(v.ev_cuando at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS'),
    v.ev_cuando > coalesce(v_visto, '-infinity'::timestamptz)
  from eventos v
  where v.ev_cuando is not null
  order by v.ev_cuando desc
  limit greatest(1, least(coalesce(p_limite, 30), 100));
end $$;

-- 3) Criterio 2: al abrir el apartado se corre la marca hasta ahora, y el contador queda en cero
--    hasta que ocurra algo nuevo. Como vive en la base, el recargar la página no lo revive.
create or replace function marcar_notificaciones_leidas() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_correo = '' then raise exception 'Debes iniciar sesión para continuar.'; end if;

  insert into usuarios (correo_institucional, notificaciones_vistas_en)
  values (v_correo, now())
  on conflict (correo_institucional) do update set notificaciones_vistas_en = now();
end $$;

-- 4) Permisos: solo con sesión iniciada. Sin sesión las funciones ni siquiera se pueden llamar.
revoke execute on function listar_notificaciones(int), marcar_notificaciones_leidas()
from public, anon;

grant execute on function listar_notificaciones(int), marcar_notificaciones_leidas()
to authenticated;
