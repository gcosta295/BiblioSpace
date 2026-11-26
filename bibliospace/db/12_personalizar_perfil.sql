-- Ejecutar después de los scripts de autenticación. Probar primero en Supabase de pruebas.
begin;

create table if not exists public.personalizacion_perfil (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  username text check (char_length(username) <= 12),
  telefono text check (telefono ~ '^\+58-[1-9][0-9]{9}$')
);

alter table public.personalizacion_perfil enable row level security;
revoke all on table public.personalizacion_perfil from public, anon, authenticated;

create or replace function public.guardar_datos_perfil(p_username text, p_telefono text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_username text := nullif(btrim(p_username), '');
  v_telefono text := nullif(btrim(p_telefono), '');
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión para continuar.';
  end if;
  if char_length(v_username) > 12 then
    raise exception 'El nombre de usuario admite hasta 12 caracteres.';
  end if;
  if v_telefono is not null and v_telefono !~ '^\+58-[1-9][0-9]{9}$' then
    raise exception 'Escribe el número con el formato +58-4242789290.';
  end if;
  insert into public.personalizacion_perfil (usuario_id, username, telefono)
  values (v_usuario, v_username, v_telefono)
  on conflict (usuario_id) do update
  set username = excluded.username, telefono = excluded.telefono;
  return jsonb_build_object('username', coalesce(v_username, ''), 'telefono', coalesce(v_telefono, ''));
end;
$$;

revoke execute on function public.guardar_datos_perfil(text, text) from public, anon;
grant execute on function public.guardar_datos_perfil(text, text) to authenticated;

create or replace function public.mi_perfil() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
  u usuarios%rowtype;
  p personalizacion_perfil%rowtype;
begin
  if v_correo = '' then raise exception 'Debes iniciar sesión para continuar.'; end if;
  select * into u from usuarios where correo_institucional = v_correo;
  select * into p from personalizacion_perfil where usuario_id = auth.uid();
  return jsonb_build_object(
    'correo', v_correo,
    'nombre', coalesce(u.nombre, ''),
    'carnet', coalesce(u.carnet, ''),
    'rol', case when u.rol = 'ADMINISTRADOR' then 'admin' else 'user' end,
    'username', coalesce(p.username, ''),
    'telefono', coalesce(p.telefono, '')
  );
end;
$$;

revoke execute on function public.mi_perfil() from public, anon;
grant execute on function public.mi_perfil() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 1000000, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Leer foto propia" on storage.objects;
create policy "Leer foto propia" on storage.objects for select to authenticated
using (bucket_id = 'fotos-perfil' and name = (select auth.uid())::text || '/foto');

drop policy if exists "Subir foto propia" on storage.objects;
create policy "Subir foto propia" on storage.objects for insert to authenticated
with check (bucket_id = 'fotos-perfil' and name = (select auth.uid())::text || '/foto');

drop policy if exists "Reemplazar foto propia" on storage.objects;
create policy "Reemplazar foto propia" on storage.objects for update to authenticated
using (bucket_id = 'fotos-perfil' and name = (select auth.uid())::text || '/foto')
with check (bucket_id = 'fotos-perfil' and name = (select auth.uid())::text || '/foto');

commit;
