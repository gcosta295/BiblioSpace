-- Ejecutar en Supabase > SQL Editor después de 10_recompensas.sql y 10_notificaciones.sql.
-- Reglas automáticas: una suspensión de 24 horas por día al exceder el límite de
-- cancelaciones, y 24 horas por reserva sin check-in (15 minutos después de finalizar).

create table if not exists suspensiones_alumno (
  id uuid primary key default gen_random_uuid(),
  correo text not null references usuarios(correo_institucional) on delete cascade,
  motivo text not null check (length(trim(motivo)) between 1 and 500),
  origen text not null check (origen in ('ADMIN', 'CANCELACIONES', 'INASISTENCIA')),
  referencia text not null,
  correo_admin text,
  inicia_en timestamptz not null default now(),
  termina_en timestamptz not null,
  creada_en timestamptz not null default now(),
  unique (correo, origen, referencia),
  check (termina_en > inicia_en)
);

create index if not exists suspensiones_alumno_vigencia_idx
  on suspensiones_alumno (correo, termina_en desc);

alter table suspensiones_alumno enable row level security;
revoke all on suspensiones_alumno from anon, authenticated;

create or replace function registrar_suspension_automatica(
  p_correo text, p_origen text, p_referencia text, p_motivo text
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_inicio timestamptz;
  v_fin timestamptz;
begin
  select greatest(now(), coalesce(max(s.termina_en), now()))
  into v_inicio
  from suspensiones_alumno s
  where s.correo = lower(trim(p_correo)) and s.termina_en > now();

  insert into suspensiones_alumno (correo, motivo, origen, referencia, inicia_en, termina_en)
  values (lower(trim(p_correo)), p_motivo, p_origen, p_referencia, v_inicio, v_inicio + interval '24 hours')
  on conflict (correo, origen, referencia) do nothing
  returning termina_en into v_fin;

  if v_fin is null then
    select s.termina_en into v_fin
    from suspensiones_alumno s
    where s.correo = lower(trim(p_correo))
      and s.origen = p_origen
      and s.referencia = p_referencia;
  end if;
  return v_fin;
end $$;

revoke execute on function registrar_suspension_automatica(text, text, text, text)
from public, anon, authenticated;

create or replace function procesar_inasistencias() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_procesadas integer;
begin
  with ausentes as (
    select p.correo_participante, r.id_reserva
    from reservas r
    join participantes_reserva p on p.id_reserva = r.id_reserva
    where r.estado in ('ANTICIPADA', 'ACTIVA', 'COMPLETADA', 'EXPIRADA')
      and upper(r.rango_horario) + interval '15 minutes' <= now()
      and p.check_in_at is null
  ), nuevas as (
    insert into suspensiones_alumno (correo, motivo, origen, referencia, inicia_en, termina_en)
    select
      a.correo_participante,
      'No registraste tu check-in en la reserva ' || a.id_reserva::text || '.',
      'INASISTENCIA',
      a.id_reserva::text || ':' || a.correo_participante,
      greatest(now(), coalesce((
        select max(s.termina_en) from suspensiones_alumno s
        where s.correo = a.correo_participante and s.termina_en > now()
      ), now())),
      greatest(now(), coalesce((
        select max(s.termina_en) from suspensiones_alumno s
        where s.correo = a.correo_participante and s.termina_en > now()
      ), now())) + interval '24 hours'
    from ausentes a
    on conflict (correo, origen, referencia) do nothing
    returning 1
  )
  select count(*)::integer into v_procesadas from nuevas;
  return v_procesadas;
end $$;

revoke execute on function procesar_inasistencias() from public, anon, authenticated;

create or replace function suspender_alumno(
  p_correo text, p_alumno text, p_motivo text, p_dias integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_alumno text := lower(trim(p_alumno));
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_fin timestamptz;
begin
  perform exigir_sesion(p_correo);
  if not es_admin(v_correo) then raise exception 'Solo administradores.'; end if;
  if v_alumno = '' or v_alumno = v_correo then raise exception 'Selecciona un alumno válido.'; end if;
  if not exists (
    select 1 from usuarios u
    where u.correo_institucional = v_alumno and u.rol <> 'ADMINISTRADOR'
  ) then raise exception 'No se encontró al alumno.'; end if;
  if v_motivo = '' or length(v_motivo) > 500 then
    raise exception 'Escribe una justificación de hasta 500 caracteres.';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'La duración debe ser de 1 a 365 días.';
  end if;

  insert into suspensiones_alumno (correo, motivo, origen, referencia, correo_admin, inicia_en, termina_en)
  values (v_alumno, v_motivo, 'ADMIN', gen_random_uuid()::text, v_correo, now(), now() + make_interval(days => p_dias))
  returning termina_en into v_fin;

  update participantes_reserva p
  set activo_en_cubiculo = false
  where p.correo_participante = v_alumno and p.activo_en_cubiculo;

  return jsonb_build_object('correo', v_alumno, 'suspendido_hasta', v_fin);
end $$;

create or replace function listar_alumnos_moderacion(p_correo text)
returns table (
  correo text, nombre text, carnet text, suspendido_hasta timestamptz,
  motivo_suspension text, total_suspensiones bigint
)
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_sesion(p_correo);
  if not es_admin(p_correo) then raise exception 'Solo administradores.'; end if;
  perform procesar_inasistencias();

  return query
  select
    u.correo_institucional,
    coalesce(u.nombre, ''),
    coalesce(u.carnet, ''),
    activa.termina_en,
    coalesce(activa.motivo, ''),
    (select count(*) from suspensiones_alumno s where s.correo = u.correo_institucional)
  from usuarios u
  left join lateral (
    select s.termina_en, s.motivo
    from suspensiones_alumno s
    where s.correo = u.correo_institucional and s.inicia_en <= now() and s.termina_en > now()
    order by s.termina_en desc
    limit 1
  ) activa on true
  where u.rol <> 'ADMINISTRADOR'
  order by lower(coalesce(u.nombre, u.correo_institucional));
end $$;

create or replace function estado_mi_suspension()
returns table (suspendido_hasta timestamptz, motivo text)
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_correo = '' then raise exception 'Debes iniciar sesión para continuar.'; end if;
  perform procesar_inasistencias();

  return query
  select s.termina_en, s.motivo
  from suspensiones_alumno s
  where s.correo = v_correo and s.inicia_en <= now() and s.termina_en > now()
  order by s.termina_en desc
  limit 1;
end $$;

create or replace function listar_notificaciones_suspensiones(p_limite integer default 30)
returns table (id text, tipo text, titulo text, detalle text, marca_tiempo text, no_leida boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_visto timestamptz;
begin
  if v_correo = '' then raise exception 'Debes iniciar sesión para continuar.'; end if;
  select u.notificaciones_vistas_en into v_visto
  from usuarios u where u.correo_institucional = v_correo;

  return query
  select
    s.id::text,
    'SUSPENSION'::text,
    'Derechos de reserva suspendidos'::text,
    s.motivo || ' La suspensión termina el '
      || to_char(s.termina_en at time zone 'America/Caracas', 'DD/MM/YYYY HH24:MI') || '.',
    to_char(s.creada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI:SS'),
    s.creada_en > coalesce(v_visto, '-infinity'::timestamptz)
  from suspensiones_alumno s
  where s.correo = v_correo
  order by s.creada_en desc
  limit greatest(1, least(coalesce(p_limite, 30), 100));
end $$;

create or replace function cancelar_reserva_con_suspension(p_correo text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_reserva reservas%rowtype;
  v_cancelaciones integer;
  v_protegida boolean;
  v_fin timestamptz;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);
  select * into v_reserva from reservas where id_reserva = p_id for update;
  if not found then raise exception 'Reserva no encontrada.'; end if;
  if v_reserva.correo_titular <> v_correo then raise exception 'No puedes modificar esta reserva.'; end if;
  if v_reserva.estado = 'ACTIVA' then raise exception 'La reserva ya está en uso y no se puede cancelar.'; end if;
  if v_reserva.estado <> 'ANTICIPADA' then raise exception 'La reserva no está activa.'; end if;
  if es_admin(v_correo) then
    perform cancelar_reserva(v_correo, p_id);
    return jsonb_build_object('cancelada', true);
  end if;
  if exists (
    select 1 from suspensiones_alumno s
    where s.correo = v_correo and s.inicia_en <= now() and s.termina_en > now()
  ) then raise exception 'Tus derechos de reserva están suspendidos.'; end if;

  select exists (
    select 1 from canjes_recompensas c
    where c.correo = v_correo and c.tipo = 'CANCELACION_TARDIA'
      and c.id_reserva = p_id and not c.usada
  ) into v_protegida;
  if not v_protegida and now() > v_reserva.hora_inicio - interval '15 minutes' then
    raise exception 'Solo se puede cancelar hasta 15 minutos antes de que empiece la reserva, salvo que tengas una protección de cancelación.';
  end if;

  select count(*)::integer into v_cancelaciones
  from reservas r
  where r.correo_titular = v_correo and r.cancelada_en is not null
    and (r.cancelada_en at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
    and not exists (
      select 1 from canjes_recompensas c
      where c.id_reserva = r.id_reserva and c.tipo = 'CANCELACION_TARDIA' and c.usada
    );

  if not v_protegida and v_cancelaciones >= 3 then
    v_fin := registrar_suspension_automatica(
      v_correo,
      'CANCELACIONES',
      (now() at time zone 'America/Caracas')::date::text,
      'Se alcanzó el límite diario de 3 cancelaciones y se intentó cancelar una reserva adicional.'
    );
    return jsonb_build_object('cancelada', false, 'suspendida', true, 'suspendido_hasta', v_fin);
  end if;

  perform cancelar_reserva(v_correo, p_id);
  return jsonb_build_object('cancelada', true);
end $$;

create or replace function abandonar_reserva(p_correo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  v_resto integer;
  v_resultado jsonb;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);
  select * into r from reservas where id_reserva = p_id for update;
  if not found then raise exception 'Reserva no encontrada.'; end if;
  if r.estado not in ('ANTICIPADA', 'ACTIVA') then raise exception 'La reserva no está activa.'; end if;
  if not exists (
    select 1 from participantes_reserva where id_reserva = p_id and correo_participante = v_correo
  ) then raise exception 'No formas parte de esta reserva.'; end if;

  if r.estado = 'ACTIVA' then
    update participantes_reserva set activo_en_cubiculo = false
    where id_reserva = p_id and correo_participante = v_correo;
    return jsonb_build_object('cancelada', false, 'mensaje', 'Has salido del cubículo.');
  end if;

  if r.correo_titular = v_correo then
    v_resultado := cancelar_reserva_con_suspension(v_correo, p_id);
    if coalesce((v_resultado ->> 'suspendida')::boolean, false) then
      return v_resultado || jsonb_build_object('mensaje', 'Se suspendieron tus derechos de reserva por exceder el límite de cancelaciones.');
    end if;
    return jsonb_build_object('cancelada', true, 'mensaje', 'Reserva cancelada.');
  end if;

  delete from participantes_reserva where id_reserva = p_id and correo_participante = v_correo;
  select count(*) into v_resto from participantes_reserva where id_reserva = p_id;
  if v_resto < 3 then
    update reservas set estado = 'CANCELADA' where id_reserva = p_id;
    return jsonb_build_object('cancelada', true, 'mensaje', 'La reserva se canceló porque quedaron menos de 3 personas.');
  end if;
  return jsonb_build_object('cancelada', false, 'mensaje', 'Has abandonado el cubículo correctamente.');
end $$;

create or replace function validar_derecho_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_correo text;
  v_fin timestamptz;
begin
  if tg_table_name = 'reservas' then
    v_correo := lower(new.correo_titular);
  else
    v_correo := lower(new.correo_participante);
  end if;
  if tg_table_name = 'participantes_reserva' and tg_op = 'UPDATE' and not new.activo_en_cubiculo then
    return new;
  end if;

  select max(s.termina_en) into v_fin
  from suspensiones_alumno s
  where s.correo = v_correo and s.inicia_en <= now() and s.termina_en > now();
  if v_fin is not null then
    raise exception 'Tus derechos de reserva están suspendidos hasta %.',
      to_char(v_fin at time zone 'America/Caracas', 'DD/MM/YYYY HH24:MI');
  end if;
  return new;
end $$;

drop trigger if exists reservas_validar_derecho on reservas;
create trigger reservas_validar_derecho
before insert on reservas
for each row execute function validar_derecho_reserva();

drop trigger if exists participantes_validar_derecho on participantes_reserva;
create trigger participantes_validar_derecho
before insert or update of activo_en_cubiculo on participantes_reserva
for each row execute function validar_derecho_reserva();

revoke execute on function cancelar_reserva(text, uuid) from public, anon, authenticated;
revoke execute on function suspender_alumno(text, text, text, integer),
  listar_alumnos_moderacion(text), estado_mi_suspension(),
  listar_notificaciones_suspensiones(integer), cancelar_reserva_con_suspension(text, uuid),
  validar_derecho_reserva() from public, anon;
revoke execute on function abandonar_reserva(text, uuid) from public, anon;
grant execute on function cancelar_reserva_con_suspension(text, uuid) to authenticated;
grant execute on function suspender_alumno(text, text, text, integer),
  listar_alumnos_moderacion(text), estado_mi_suspension(),
  listar_notificaciones_suspensiones(integer), abandonar_reserva(text, uuid)
to authenticated;

-- Registrar una inasistencia en cuanto termina el turno, aunque nadie vuelva a abrir la app.
create extension if not exists pg_cron;
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'bibliospace-procesar-inasistencias';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'bibliospace-procesar-inasistencias',
    '* * * * *',
    'select public.procesar_inasistencias();'
  );
end $$;
