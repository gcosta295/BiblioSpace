-- Ejecutar en Supabase > SQL Editor, DESPUÉS de 10_recompensas.sql. Se puede repetir.
-- Arreglo del Pase Express ("Agrega una hora a tu reserva mientras está en curso").
--
-- Problema: canjear el pase hace  duracion_minutos = duracion_minutos + 60, pero la tabla `reservas`
-- solo aceptaba hasta 120 minutos. Una reserva de 2 horas no se podía extender (error de restricción)
-- y solo funcionaba con reservas de 1 hora.
--
-- Solución: la tabla admite hasta 180 minutos (2 h + la hora extra del pase). Las reservas nuevas
-- siguen limitadas a 2 horas porque crear_reserva solo acepta 1 o 2 horas.

alter table reservas drop constraint if exists reservas_duracion_minutos_check;
alter table reservas
  add constraint reservas_duracion_minutos_check
  check (duracion_minutos > 0 and duracion_minutos <= 180);
