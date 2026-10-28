-- Ejecutar en Supabase > SQL Editor, después de 03_nombre_carnet.sql. Se puede repetir.
-- HU: como administrador quiero poder liberar manualmente un cubículo.
--
-- Liberar = sacar a la gente de un cubículo que está en uso y dejarlo disponible otra vez.
-- Reglas (criterios de aceptación de la tarjeta):
--   1. Si el cubículo está libre      -> no se puede liberar.
--   2. Si el cubículo está bloqueado  -> no se puede liberar (primero se desbloquea).
--   3. Si está reservado              -> se expulsa a los miembros y luego se libera.
--   4. Queda registro de: qué admin lo hizo, el motivo, qué cubículo y qué usuarios estaban dentro.

-- 1) La acción nueva del log. 'if not exists' deja repetir el script sin error.
alter type naturaleza_accion add value if not exists 'LIBERACION';

-- 2) Columnas del registro (criterio 4). No tocan nada de lo que ya existe.
alter table log_administrador add column if not exists id_reserva uuid;
alter table log_administrador add column if not exists ocupantes text[] not null default '{}';

-- 3) Liberar un cubículo
--    Devuelve { cubiculo, id_reserva, ocupantes[], personas } para poder avisar en la interfaz.
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

-- 4) Leer el registro de acciones de administración (solo admin).
--    Alimenta el "Log de Actividad" del panel: bloqueos, habilitaciones y liberaciones.
create or replace function listar_log_admin(p_correo text, p_limite int default 20)
returns table (
  id_cubiculo text, accion text, correo_admin text, motivo text,
  ocupantes text[], marca_tiempo text
)
language plpgsql stable security definer set search_path = public as $$
begin
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

-- 5) Permisos: la app (clave pública) solo puede llamar a estas dos funciones nuevas.
grant execute on function
  liberar_cubiculo(text, text, text),
  listar_log_admin(text, int)
to anon, authenticated;
