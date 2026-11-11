-- Ejecutar en Supabase > SQL Editor después de 09_exigir_sesion.sql.
-- Recompensas, asistencia por participante y reglas de reservas asociadas.

alter table participantes_reserva
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz,
  add column if not exists bono_favorito_aplica boolean not null default false;
alter table usuarios add column if not exists cubiculo_favorito text;

create or replace function capturar_bono_cubiculo_favorito() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.bono_favorito_aplica := exists (
    select 1
    from reservas r
    join usuarios u on u.correo_institucional = new.correo_participante
    where r.id_reserva = new.id_reserva and u.cubiculo_favorito = r.id_cubiculo
  );
  return new;
end $$;

drop trigger if exists participantes_capturar_bono_favorito on participantes_reserva;
create trigger participantes_capturar_bono_favorito
before insert on participantes_reserva
for each row execute function capturar_bono_cubiculo_favorito();

create table if not exists catalogo_recompensas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'VENTANA_ANTICIPADA', 'PASE_EXPRESS', 'FAVORITO', 'CANCELACION_TARDIA'
  )),
  nombre text not null,
  descripcion text not null default '',
  costo_horas numeric(8, 2) not null check (costo_horas > 0),
  stock integer check (stock is null or stock >= 0),
  activo boolean not null default true,
  creada_en timestamptz not null default now()
);

create table if not exists horas_estudio (
  id bigint generated always as identity primary key,
  id_reserva uuid not null references reservas(id_reserva) on delete cascade,
  correo text not null references usuarios(correo_institucional) on delete cascade,
  horas_sesion numeric(8, 2) not null check (horas_sesion > 0),
  bono_favorito numeric(8, 2) not null default 0 check (bono_favorito >= 0),
  registrada_en timestamptz not null default now(),
  unique (id_reserva, correo)
);

create table if not exists canjes_recompensas (
  id uuid primary key default gen_random_uuid(),
  id_recompensa uuid not null references catalogo_recompensas(id),
  tipo text not null,
  nombre text not null,
  correo text not null references usuarios(correo_institucional) on delete cascade,
  costo_horas numeric(8, 2) not null check (costo_horas > 0),
  id_reserva uuid references reservas(id_reserva) on delete set null,
  reservas_restantes integer not null default 0 check (reservas_restantes >= 0),
  usada boolean not null default false,
  canjeada_en timestamptz not null default now(),
  usada_en timestamptz
);

alter table catalogo_recompensas enable row level security;
alter table horas_estudio enable row level security;
alter table canjes_recompensas enable row level security;
revoke all on catalogo_recompensas, horas_estudio, canjes_recompensas
  from anon, authenticated;

insert into catalogo_recompensas (tipo, nombre, descripcion, costo_horas, stock)
select seed.tipo, seed.nombre, seed.descripcion, seed.costo_horas, seed.stock
from (values
  ('VENTANA_ANTICIPADA', 'Reserva Anticipada / Ventana Extendida',
   'Reserva hasta 48 horas antes en tus siguientes cinco reservas.', 20::numeric, null::integer),
  ('PASE_EXPRESS', 'Extensión de Tiempo de Reserva (Pase Express)',
   'Agrega una hora a tu reserva mientras está en curso, sujeto a disponibilidad.', 15::numeric, null::integer),
  ('FAVORITO', 'Selección de Cubículo Específico (Cubículo VIP/Favorito)',
   'Marca un cubículo como favorito. Las sesiones completadas allí otorgan dos horas extra.', 30::numeric, null::integer),
  ('CANCELACION_TARDIA', 'Renuncia de Penalización por Cancelación Tardía',
   'Cancela una reserva futura sin consumir una de tus tres cancelaciones diarias.', 10::numeric, null::integer)
) as seed(tipo, nombre, descripcion, costo_horas, stock)
where not exists (select 1 from catalogo_recompensas c where c.tipo = seed.tipo);

create or replace function validar_ventana_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_antelacion interval := new.hora_inicio - now();
  v_pase uuid;
begin
  if v_correo = '' or v_correo is distinct from lower(new.correo_titular) then
    raise exception 'Debes iniciar sesión para reservar.';
  end if;
  if es_admin(v_correo) then raise exception 'Las cuentas de administrador no pueden reservar cubículos.'; end if;
  if v_antelacion > interval '48 hours' then
    raise exception 'Solo puedes reservar con un máximo de 24 horas de antelación, o 48 horas con el pase extendido.';
  end if;

  select c.id into v_pase
  from canjes_recompensas c
  where c.correo = v_correo and c.tipo = 'VENTANA_ANTICIPADA' and c.reservas_restantes > 0
  order by c.canjeada_en
  limit 1
  for update skip locked;

  if v_antelacion > interval '24 hours' and v_pase is null then
    raise exception 'Solo puedes reservar con 24 horas de antelación. Canjea la ventana extendida para reservar hasta con 48 horas.';
  end if;
  if v_pase is not null then
    update canjes_recompensas
    set reservas_restantes = reservas_restantes - 1
    where id = v_pase;
  end if;
  return new;
end $$;

drop trigger if exists reservas_validar_ventana_recompensas on reservas;
create trigger reservas_validar_ventana_recompensas
before insert on reservas
for each row execute function validar_ventana_reserva();

create or replace function registrar_check_in(p_correo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  p participantes_reserva%rowtype;
begin
  perform exigir_sesion(p_correo);
  if es_admin(v_correo) then raise exception 'Las cuentas de administrador no pueden registrar horas de estudio.'; end if;

  select * into r from reservas where id_reserva = p_id for update;
  if not found or r.estado not in ('ANTICIPADA', 'ACTIVA') then raise exception 'La reserva no está vigente.'; end if;
  if not (r.rango_horario @> now()) then raise exception 'El check-in solo se permite durante el horario de la reserva.'; end if;

  select * into p from participantes_reserva
  where id_reserva = p_id and correo_participante = v_correo
  for update;
  if not found then raise exception 'No formas parte de esta reserva.'; end if;
  if p.check_in_at is not null then raise exception 'Ya registraste el check-in de esta reserva.'; end if;

  update participantes_reserva
  set check_in_at = now(), activo_en_cubiculo = true
  where id_reserva = p_id and correo_participante = v_correo;
  return jsonb_build_object('check_in_at', now());
end $$;

create or replace function registrar_check_out(p_correo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  p participantes_reserva%rowtype;
  v_horas numeric(8, 2);
  v_bono numeric(8, 2);
begin
  perform exigir_sesion(p_correo);
  if es_admin(v_correo) then raise exception 'Las cuentas de administrador no pueden registrar horas de estudio.'; end if;

  select * into r from reservas where id_reserva = p_id for update;
  if not found then raise exception 'Reserva no encontrada.'; end if;
  if r.estado not in ('ANTICIPADA', 'ACTIVA') then raise exception 'La reserva ya no está en curso.'; end if;
  select * into p from participantes_reserva
  where id_reserva = p_id and correo_participante = v_correo
  for update;
  if not found then raise exception 'No formas parte de esta reserva.'; end if;
  if p.check_in_at is null then raise exception 'Debes completar el check-in antes del check-out.'; end if;
  if p.check_out_at is not null then raise exception 'Ya registraste el check-out de esta reserva.'; end if;
  if now() <= p.check_in_at then raise exception 'El check-out debe ser posterior al check-in.'; end if;
  if now() > upper(r.rango_horario) then raise exception 'El check-out debe registrarse antes de que termine la reserva.'; end if;

  v_horas := round(extract(epoch from (
    least(now(), upper(r.rango_horario)) - greatest(p.check_in_at, lower(r.rango_horario))
  )) / 3600.0, 2);
  if v_horas <= 0 then raise exception 'La sesión no acumuló tiempo de estudio.'; end if;
  v_bono := case when p.bono_favorito_aplica then 2 else 0 end;

  update participantes_reserva
  set check_out_at = now(), activo_en_cubiculo = false
  where id_reserva = p_id and correo_participante = v_correo;

  insert into horas_estudio (id_reserva, correo, horas_sesion, bono_favorito)
  values (p_id, v_correo, v_horas, v_bono)
  on conflict (id_reserva, correo) do nothing;

  return jsonb_build_object('horas_sesion', v_horas, 'bono_favorito', v_bono, 'horas_ganadas', v_horas + v_bono);
end $$;

create or replace function estado_asistencia_reserva(p_correo text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  p participantes_reserva%rowtype;
begin
  perform exigir_sesion(p_correo);
  select * into p from participantes_reserva
  where id_reserva = p_id and correo_participante = v_correo;
  if not found then raise exception 'No formas parte de esta reserva.'; end if;
  return jsonb_build_object('check_in_at', p.check_in_at, 'check_out_at', p.check_out_at);
end $$;

create or replace function recompensas_usuario(p_correo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_total numeric(10, 2);
  v_gastado numeric(10, 2);
  v_semanas jsonb;
  v_historial jsonb;
begin
  perform exigir_sesion(p_correo);
  if es_admin(v_correo) then raise exception 'El catálogo de recompensas es exclusivo para estudiantes.'; end if;

  select coalesce(sum(h.horas_sesion + h.bono_favorito), 0) into v_total
  from horas_estudio h where h.correo = v_correo;
  select coalesce(sum(c.costo_horas), 0) into v_gastado
  from canjes_recompensas c where c.correo = v_correo;

  select coalesce(jsonb_agg(jsonb_build_object(
    'semana', to_char(w.inicio, 'YYYY-MM-DD'), 'horas', coalesce(t.horas, 0)
  ) order by w.inicio), '[]'::jsonb) into v_semanas
  from (
    select date_trunc('week', now() at time zone 'America/Caracas')::date - (n * 7) as inicio
    from generate_series(11, 0, -1) n
  ) w
  left join (
    select date_trunc('week', h.registrada_en at time zone 'America/Caracas')::date as inicio,
      sum(h.horas_sesion + h.bono_favorito) as horas
    from horas_estudio h
    where h.correo = v_correo
      and h.registrada_en >= (
        date_trunc('week', now() at time zone 'America/Caracas') - interval '11 weeks'
      ) at time zone 'America/Caracas'
    group by 1
  ) t on t.inicio = w.inicio;

  select coalesce(jsonb_agg(evento order by fecha desc), '[]'::jsonb) into v_historial
  from (
    select h.registrada_en as fecha,
      jsonb_build_object(
        'tipo', 'ganada', 'fecha', to_char(h.registrada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI'),
        'detalle', 'Reserva completada · Cubículo ' || split_part(r.id_cubiculo, '-', 2) ||
          ' · Piso ' || split_part(r.id_cubiculo, '-', 1) || ' · ' ||
          to_char(r.hora_inicio at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI'),
        'horas', h.horas_sesion, 'bono_favorito', h.bono_favorito,
        'id_reserva', h.id_reserva
      ) as evento
    from horas_estudio h
    join reservas r on r.id_reserva = h.id_reserva
    where h.correo = v_correo
    union all
    select c.canjeada_en as fecha,
      jsonb_build_object(
        'tipo', 'canje', 'fecha', to_char(c.canjeada_en at time zone 'America/Caracas', 'YYYY-MM-DD HH24:MI'),
        'detalle', c.nombre, 'horas', -c.costo_horas, 'id_reserva', c.id_reserva
      ) as evento
    from canjes_recompensas c where c.correo = v_correo
  ) e;

  return jsonb_build_object(
    'horas_acumuladas', v_total,
    'saldo', v_total - v_gastado,
    'horas_gastadas', v_gastado,
    'reservas_completadas_esta_semana', coalesce((
      select count(*) from horas_estudio h
      where h.correo = v_correo
        and h.registrada_en >= date_trunc('week', now() at time zone 'America/Caracas') at time zone 'America/Caracas'
    ), 0),
    'cubiculo_favorito', (select u.cubiculo_favorito from usuarios u where u.correo_institucional = v_correo),
    'reserva_cancelacion_protegida', (
      select c.id_reserva::text from canjes_recompensas c
      where c.correo = v_correo and c.tipo = 'CANCELACION_TARDIA' and not c.usada
        and c.id_reserva is not null
    order by c.canjeada_en limit 1
    ),
    'ventana_48_restantes', coalesce((
      select sum(c.reservas_restantes) from canjes_recompensas c
      where c.correo = v_correo and c.tipo = 'VENTANA_ANTICIPADA' and c.reservas_restantes > 0
    ), 0),
    'catalogo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'tipo', c.tipo, 'nombre', c.nombre, 'descripcion', c.descripcion,
        'costo_horas', c.costo_horas, 'stock', c.stock
      ) order by c.costo_horas, c.nombre)
      from catalogo_recompensas c where c.activo
    ), '[]'::jsonb),
    'semanas', v_semanas,
    'historial', v_historial
  );
end $$;

create or replace function canjear_recompensa(p_correo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  c catalogo_recompensas%rowtype;
  r reservas%rowtype;
  v_saldo numeric(10, 2);
  v_id_canje uuid;
  v_fin_cierre timestamptz;
begin
  perform exigir_sesion(p_correo);
  if es_admin(v_correo) then raise exception 'Las cuentas de administrador no pueden canjear recompensas.'; end if;
  perform pg_advisory_xact_lock(727001);

  select * into c from catalogo_recompensas where id = p_id and activo for update;
  if not found then raise exception 'La recompensa ya no está disponible.'; end if;
  if c.tipo = 'FAVORITO' then raise exception 'Selecciona un cubículo para completar el canje.'; end if;
  if c.stock is not null and c.stock <= 0 then raise exception 'La recompensa está agotada.'; end if;

  select coalesce(sum(h.horas_sesion + h.bono_favorito), 0) -
    coalesce((select sum(x.costo_horas) from canjes_recompensas x where x.correo = v_correo), 0)
  into v_saldo from horas_estudio h where h.correo = v_correo;
  if v_saldo < c.costo_horas then raise exception 'No tienes suficientes horas para este canje.'; end if;

  if c.tipo = 'PASE_EXPRESS' then
    select * into r from reservas
    where exists (
      select 1 from participantes_reserva p
      where p.id_reserva = reservas.id_reserva and p.correo_participante = v_correo
        and p.check_in_at is not null and p.check_out_at is null
    )
      and estado in ('ANTICIPADA', 'ACTIVA') and rango_horario @> now()
    order by hora_inicio limit 1 for update;
    if not found then raise exception 'El Pase Express solo se puede canjear durante una reserva en curso.'; end if;
    v_fin_cierre := ((r.hora_inicio at time zone 'America/Caracas')::date + time '17:00') at time zone 'America/Caracas';
    if upper(r.rango_horario) + interval '1 hour' > v_fin_cierre then
      raise exception 'No se puede extender la reserva más allá del cierre de la biblioteca.';
    end if;
    if exists (
      select 1 from reservas x
      where x.id_cubiculo = r.id_cubiculo and x.id_reserva <> r.id_reserva
        and x.estado in ('ANTICIPADA', 'ACTIVA')
        and x.rango_horario && tstzrange(upper(r.rango_horario), upper(r.rango_horario) + interval '1 hour', '[)')
    ) then raise exception 'El cubículo ya está reservado durante la hora siguiente.'; end if;
    update reservas set duracion_minutos = duracion_minutos + 60 where id_reserva = r.id_reserva;
  elsif c.tipo = 'CANCELACION_TARDIA' then
    select * into r from reservas
    where correo_titular = v_correo and estado = 'ANTICIPADA' and hora_inicio > now()
    order by hora_inicio limit 1 for update;
    if not found then raise exception 'Necesitas una reserva futura para canjear esta protección de cancelación.'; end if;
  elsif c.tipo <> 'VENTANA_ANTICIPADA' then
    raise exception 'Tipo de recompensa no válido.';
  end if;

  if c.stock is not null then
    update catalogo_recompensas set stock = stock - 1 where id = c.id;
  end if;
  insert into canjes_recompensas (
    id_recompensa, tipo, nombre, correo, costo_horas, id_reserva, reservas_restantes
  ) values (
    c.id, c.tipo, c.nombre, v_correo, c.costo_horas,
    case when c.tipo in ('PASE_EXPRESS', 'CANCELACION_TARDIA') then r.id_reserva else null end,
    case when c.tipo = 'VENTANA_ANTICIPADA' then 5 else 0 end
  ) returning id into v_id_canje;

  return jsonb_build_object('id', v_id_canje, 'mensaje', 'Recompensa canjeada correctamente.');
end $$;

create or replace function canjear_favorito(p_correo text, p_id uuid, p_cubiculo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  c catalogo_recompensas%rowtype;
  v_saldo numeric(10, 2);
begin
  perform exigir_sesion(p_correo);
  if es_admin(v_correo) then raise exception 'Las cuentas de administrador no pueden canjear recompensas.'; end if;
  perform pg_advisory_xact_lock(727001);
  if not exists (select 1 from cubiculos where id = p_cubiculo) then raise exception 'El cubículo no existe.'; end if;
  if (select cubiculo_favorito from usuarios where correo_institucional = v_correo) is not null then
    raise exception 'Quita tu cubículo favorito actual antes de elegir otro.';
  end if;
  select * into c from catalogo_recompensas where id = p_id and tipo = 'FAVORITO' and activo for update;
  if not found then raise exception 'La recompensa de cubículo favorito no está disponible.'; end if;
  if c.stock is not null and c.stock <= 0 then raise exception 'La recompensa está agotada.'; end if;
  select coalesce(sum(h.horas_sesion + h.bono_favorito), 0) -
    coalesce((select sum(x.costo_horas) from canjes_recompensas x where x.correo = v_correo), 0)
  into v_saldo from horas_estudio h where h.correo = v_correo;
  if v_saldo < c.costo_horas then raise exception 'No tienes suficientes horas para este canje.'; end if;

  update usuarios set cubiculo_favorito = p_cubiculo where correo_institucional = v_correo;
  if c.stock is not null then update catalogo_recompensas set stock = stock - 1 where id = c.id; end if;
  insert into canjes_recompensas (id_recompensa, tipo, nombre, correo, costo_horas)
  values (c.id, c.tipo, c.nombre, v_correo, c.costo_horas);
  return jsonb_build_object('cubiculo_favorito', p_cubiculo, 'mensaje', 'Cubículo favorito actualizado.');
end $$;

create or replace function quitar_cubiculo_favorito(p_correo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_sesion(p_correo);
  if es_admin(p_correo) then raise exception 'Solo los estudiantes pueden gestionar un cubículo favorito.'; end if;
  update usuarios set cubiculo_favorito = null where correo_institucional = lower(trim(p_correo));
end $$;

create or replace function cancelar_reserva(p_correo text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  v_admin boolean;
  v_hoy int;
  v_pase uuid;
begin
  perform exigir_sesion(p_correo);
  perform pg_advisory_xact_lock(727001);
  select * into r from reservas where id_reserva = p_id for update;
  if not found then raise exception 'Reserva no encontrada.'; end if;

  v_admin := es_admin(v_correo);
  if r.correo_titular <> v_correo and not v_admin then raise exception 'No puedes modificar esta reserva.'; end if;
  if r.estado = 'ACTIVA' then raise exception 'La reserva ya está en uso y no se puede cancelar.'; end if;
  if r.estado <> 'ANTICIPADA' then raise exception 'La reserva no está activa.'; end if;

  if not v_admin then
    select id into v_pase from canjes_recompensas
    where correo = v_correo and tipo = 'CANCELACION_TARDIA'
      and id_reserva = p_id and not usada
    order by canjeada_en limit 1 for update;
    if v_pase is null then
      if now() > r.hora_inicio - interval '15 minutes' then
        raise exception 'Solo se puede cancelar hasta 15 minutos antes de que empiece la reserva, salvo que tengas una protección de cancelación.';
      end if;
      select count(*) into v_hoy from reservas
      where correo_titular = v_correo and cancelada_en is not null
        and (cancelada_en at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
        and not exists (
          select 1 from canjes_recompensas x
          where x.id_reserva = reservas.id_reserva
            and x.tipo = 'CANCELACION_TARDIA' and x.usada
        );
      if v_hoy >= 3 then raise exception 'Alcanzaste el máximo de 3 cancelaciones por día.'; end if;
    else
      if now() >= r.hora_inicio then raise exception 'No se puede cancelar una reserva que ya comenzó.'; end if;
      update canjes_recompensas set usada = true, usada_en = now() where id = v_pase;
    end if;
  end if;

  update reservas set estado = 'CANCELADA', cancelada_en = now() where id_reserva = p_id;
end $$;

create or replace function guardar_recompensa(
  p_correo text, p_id uuid, p_tipo text, p_nombre text, p_descripcion text,
  p_costo numeric, p_stock integer, p_activo boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform exigir_sesion(p_correo);
  if not es_admin(p_correo) then raise exception 'Solo administradores.'; end if;
  if p_tipo not in ('VENTANA_ANTICIPADA', 'PASE_EXPRESS', 'FAVORITO', 'CANCELACION_TARDIA') then raise exception 'Tipo de recompensa inválido.'; end if;
  if trim(coalesce(p_nombre, '')) = '' or length(p_nombre) > 120 then raise exception 'Escribe un nombre de hasta 120 caracteres.'; end if;
  if p_costo is null or p_costo <= 0 then raise exception 'El costo debe ser mayor que cero.'; end if;
  if p_stock is not null and p_stock < 0 then raise exception 'El stock no puede ser negativo.'; end if;

  if p_id is null then
    insert into catalogo_recompensas (tipo, nombre, descripcion, costo_horas, stock, activo)
    values (p_tipo, trim(p_nombre), trim(coalesce(p_descripcion, '')), p_costo, p_stock, coalesce(p_activo, true))
    returning id into v_id;
  else
    update catalogo_recompensas
    set tipo = p_tipo, nombre = trim(p_nombre), descripcion = trim(coalesce(p_descripcion, '')),
      costo_horas = p_costo, stock = p_stock, activo = coalesce(p_activo, true)
    where id = p_id returning id into v_id;
    if not found then raise exception 'La recompensa no existe.'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function listar_recompensas_admin(p_correo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_sesion(p_correo);
  if not es_admin(p_correo) then raise exception 'Solo administradores.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'nombre', c.nombre, 'descripcion', c.descripcion,
      'costo_horas', c.costo_horas, 'stock', c.stock, 'activo', c.activo
    ) order by c.costo_horas, c.nombre) from catalogo_recompensas c
  ), '[]'::jsonb);
end $$;

create or replace function reporte_recompensas_admin(p_correo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform exigir_sesion(p_correo);
  if not es_admin(p_correo) then raise exception 'Solo administradores.'; end if;
  return jsonb_build_object(
    'mas_canjeadas', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', c.nombre, 'canjes', x.total) order by x.total desc, c.nombre)
      from catalogo_recompensas c
      join (select id_recompensa, count(*) as total from canjes_recompensas group by id_recompensa) x
        on x.id_recompensa = c.id
    ), '[]'::jsonb),
    'mas_horas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'correo', x.correo, 'nombre', coalesce(u.nombre, x.correo),
        'horas', x.horas
      ) order by x.horas desc, x.correo)
      from (
        select correo, sum(horas_sesion + bono_favorito) as horas
        from horas_estudio group by correo order by horas desc limit 10
      ) x
      left join usuarios u on u.correo_institucional = x.correo
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function
  capturar_bono_cubiculo_favorito(), validar_ventana_reserva(),
  registrar_check_in(text, uuid), registrar_check_out(text, uuid),
  estado_asistencia_reserva(text, uuid),
  recompensas_usuario(text), canjear_recompensa(text, uuid), canjear_favorito(text, uuid, text),
  quitar_cubiculo_favorito(text), guardar_recompensa(text, uuid, text, text, text, numeric, integer, boolean),
  listar_recompensas_admin(text), reporte_recompensas_admin(text)
from public, anon;

grant execute on function
  registrar_check_in(text, uuid), registrar_check_out(text, uuid), estado_asistencia_reserva(text, uuid),
  recompensas_usuario(text),
  canjear_recompensa(text, uuid), canjear_favorito(text, uuid, text), quitar_cubiculo_favorito(text),
  guardar_recompensa(text, uuid, text, text, text, numeric, integer, boolean),
  listar_recompensas_admin(text), reporte_recompensas_admin(text)
to authenticated;

grant execute on function cancelar_reserva(text, uuid) to authenticated;
