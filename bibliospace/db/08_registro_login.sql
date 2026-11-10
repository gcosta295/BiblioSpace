-- Ejecutar en Supabase > SQL Editor, después de 07_validar_nombre_carnet.sql. Se puede repetir.
-- HU: como usuario quiero registrarme para guardar mis datos y tener una sesión permanente.
--
-- ANTES de probar el registro, en el panel de Supabase:
--   Authentication > Providers > Email: activado, y "Confirm email" APAGADO
--   (así el registro deja la sesión iniciada y Supabase avisa claro si el correo ya existe).
--   Authentication > Sign In / Providers: largo mínimo de contraseña 8.
--
-- Qué hace este archivo (no rompe nada existente):
--   1. correo_valido: acepta @correo.unimet.edu.ve y @unimet.edu.ve (igual que el cliente) y exige un
--      usuario que empiece y termine en letra.
--   2. Trigger en auth.users: valida correo, nombre y carnet ANTES de crear la cuenta. Si falta algo o es
--      inválido, el registro falla en el servidor aunque se llame directo a la API. Si es válido, guarda
--      nombre y carnet en `usuarios` sin tocar el rol (el admin sembrado sigue siendo admin).
--   3. correo_registrado: para avisar "este correo no está registrado" al iniciar sesión.
--   4. mi_perfil: datos y rol de la sesión actual.

-- 1) Dominios permitidos (cliente y servidor deben coincidir)
create or replace function correo_valido(p text) returns boolean
language sql immutable as $$
  select p ~ '^[^@[:space:]]+@(correo\.)?unimet\.edu\.ve$'
     and split_part(p, '@', 1) ~ '^[a-zA-Z](.*[a-zA-Z])?$'
$$;

-- 2) Validación del registro
create or replace function public.validar_registro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(coalesce(new.email, '')));
  v_nombre text := trim(coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  v_carnet text := trim(coalesce(new.raw_user_meta_data ->> 'carnet', ''));
begin
  if not correo_valido(v_correo) then
    raise exception 'Solo se permiten correos institucionales (@correo.unimet.edu.ve o @unimet.edu.ve).';
  end if;
  if v_nombre = '' or length(v_nombre) > 100
     or v_nombre !~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$' then
    raise exception 'El nombre solo puede tener letras y espacios, sin números ni caracteres especiales.';
  end if;
  if v_carnet !~ '^[1-9][0-9]{10}$' then
    raise exception 'El carnet debe ser un número positivo de 11 dígitos.';
  end if;

  -- Si la persona ya existía en `usuarios` (p. ej. la invitaron antes), se completa su ficha.
  insert into usuarios (correo_institucional, nombre, carnet)
  values (v_correo, v_nombre, v_carnet)
  on conflict (correo_institucional) do update set nombre = excluded.nombre, carnet = excluded.carnet;

  return new;
end $$;

revoke execute on function public.validar_registro() from public, anon, authenticated;

drop trigger if exists validar_registro on auth.users;
create trigger validar_registro
before insert on auth.users
for each row execute function public.validar_registro();

-- 3) ¿Ese correo ya tiene cuenta? (una fila en `usuarios` creada por una invitación NO cuenta como registrado)
create or replace function correo_registrado(p_correo text) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(coalesce(p_correo, '')))
  )
$$;

grant execute on function correo_registrado(text) to anon, authenticated;

-- 4) Perfil de la sesión actual: { correo, nombre, carnet, rol: 'admin' | 'user' }
create or replace function mi_perfil() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
  u usuarios%rowtype;
begin
  if v_correo = '' then raise exception 'Debes iniciar sesión para continuar.'; end if;
  select * into u from usuarios where correo_institucional = v_correo;
  return jsonb_build_object(
    'correo', v_correo,
    'nombre', coalesce(u.nombre, ''),
    'carnet', coalesce(u.carnet, ''),
    'rol', case when u.rol = 'ADMINISTRADOR' then 'admin' else 'user' end
  );
end $$;

revoke execute on function mi_perfil() from public, anon;
grant execute on function mi_perfil() to authenticated;
