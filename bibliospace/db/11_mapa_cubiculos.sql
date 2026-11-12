-- Ejecutar en Supabase > SQL Editor, después de 10_recompensas.sql y 10_notificaciones.sql.
-- Se puede repetir sin perder datos.
--
-- HU Sprint 3: "Como administrador quiero tener un diseño del mapa de cubículos ordenado
-- (botones correspondientes en donde se encuentren los cubículos)".
--
--   1) cubiculos.pos_x / pos_y: posición física dentro del piso, en % del ancho y alto
--      del plano. El frontend (utils/plano.js) ya las lee como Pos_X / Pos_Y.
--   2) listar_cubiculos() devuelve además pos_x y pos_y. Todo lo demás queda igual.
--   3) ubicar_cubiculos(): el admin guarda el plano desde "Editar plano". Queda en el log.
--   4) Posiciones iniciales de los 12 cubículos, ordenadas por número. Solo se escriben
--      donde todavía no hay posición: volver a correr el script no pisa lo que el admin movió.

-- 1) Columnas
alter table cubiculos add column if not exists pos_x numeric(5, 2);
alter table cubiculos add column if not exists pos_y numeric(5, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cubiculos_pos_rango') then
    alter table cubiculos add constraint cubiculos_pos_rango check (
      (pos_x is null or pos_x between 0 and 100) and (pos_y is null or pos_y between 0 and 100)
    );
  end if;
end $$;

-- Nueva acción para el log de actividad del admin
alter type naturaleza_accion add value if not exists 'UBICACION';

-- 2) listar_cubiculos con posiciones. Cambia el tipo de retorno, por eso se recrea;
--    el cuerpo es el mismo de 02_funciones.sql más las dos columnas nuevas.
drop function if exists listar_cubiculos();

create function listar_cubiculos()
returns table (id text, piso int, numero int, estado text, motivo text, pos_x numeric, pos_y numeric)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    split_part(c.id, '-', 1)::int,
    split_part(c.id, '-', 2)::int,
    c.estado_ocupacion::text,
    case when c.estado_ocupacion = 'BLOQUEADO' then coalesce((
      select l.motivo from log_administrador l
      where l.id_cubiculo = c.id and l.naturaleza_accion = 'BLOQUEO'
      order by l.marca_tiempo desc limit 1), '') else '' end,
    c.pos_x,
    c.pos_y
  from cubiculos c
  where c.id ~ '^[0-9]+-[0-9]+$'
  order by 2, 3
$$;

grant execute on function listar_cubiculos() to anon, authenticated;

-- 3) Guardar el plano. p_cambios = [{ "id": "1-3", "x": 61, "y": 19 }, ...]
--    Todo o nada: si un cubículo falla, no se guarda ninguno.
create or replace function ubicar_cubiculos(p_correo text, p_cambios jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_item jsonb;
  v_id text;
  v_x numeric;
  v_y numeric;
  v_total int := 0;
begin
  perform exigir_sesion(p_correo);
  if not es_admin(v_correo) then raise exception 'Solo administradores.'; end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'array' or jsonb_array_length(p_cambios) = 0 then
    raise exception 'No hay cambios que guardar.';
  end if;
  if jsonb_array_length(p_cambios) > 100 then raise exception 'Demasiados cambios a la vez.'; end if;

  perform pg_advisory_xact_lock(727001);

  for v_item in select * from jsonb_array_elements(p_cambios) loop
    v_id := v_item ->> 'id';
    begin
      v_x := round((v_item ->> 'x')::numeric, 2);
      v_y := round((v_item ->> 'y')::numeric, 2);
    exception when others then
      raise exception 'Posición inválida para el cubículo %.', coalesce(v_id, '?');
    end;

    if v_x is null or v_y is null or v_x not between 0 and 100 or v_y not between 0 and 100 then
      raise exception 'La posición del cubículo % debe estar dentro del plano.', coalesce(v_id, '?');
    end if;

    update cubiculos set pos_x = v_x, pos_y = v_y, ultima_actualizacion = now() where id = v_id;
    if not found then raise exception 'El cubículo % no existe.', coalesce(v_id, '?'); end if;

    insert into log_administrador (id_cubiculo, naturaleza_accion, correo_admin, motivo)
    values (v_id, 'UBICACION'::naturaleza_accion, v_correo, 'Posición ' || v_x || ' % · ' || v_y || ' %');

    v_total := v_total + 1;
  end loop;

  return jsonb_build_object('actualizados', v_total);
end $$;

revoke execute on function ubicar_cubiculos(text, jsonb) from public;
grant execute on function ubicar_cubiculos(text, jsonb) to anon, authenticated;

-- 4) Plano inicial: filas ordenadas por número, lejos de entrada, escalera y estanterías
--    (ver REFERENCIAS en src/utils/plano.js). El admin puede ajustarlo luego desde el mapa.
update cubiculos c
set pos_x = v.x, pos_y = v.y
from (values
  ('1-1', 17, 19), ('1-2', 39, 19), ('1-3', 61, 19), ('1-4', 83, 19),
  ('1-5', 28, 56), ('1-6', 56, 56),
  ('2-1', 20, 19), ('2-2', 42, 19), ('2-3', 64, 19), ('2-4', 86, 19),
  ('2-5', 36, 56), ('2-6', 64, 56)
) as v(id, x, y)
where c.id = v.id and c.pos_x is null and c.pos_y is null;
