-- Ejecutar en Supabase > SQL Editor, después de 04_liberacion_manual.sql. Se puede repetir.
-- HU: como integrante quiero poder abandonar un cubículo. (Antes vivía en backend/Code.gs, ya eliminado.)
--
-- Reglas:
--   - Reserva futura (ANTICIPADA):
--       * el titular abandona  -> se cancela toda la reserva (mismas reglas que cancelar_reserva)
--       * un integrante sale   -> se le quita; si quedan menos de 3 personas, la reserva se cancela sola
--   - Reserva en uso (ACTIVA): la persona sale del cubículo (activo_en_cubiculo = false) y los
--     triggers existentes cierran la reserva si se va el titular o quedan menos de 3 dentro.
-- Cuando la reserva se cancela por falta de gente no se anota cancelada_en, para no gastar
-- una de las 3 cancelaciones diarias del titular.

create or replace function abandonar_reserva(p_correo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  r reservas%rowtype;
  v_resto int;
begin
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

grant execute on function abandonar_reserva(text, uuid) to anon, authenticated;
