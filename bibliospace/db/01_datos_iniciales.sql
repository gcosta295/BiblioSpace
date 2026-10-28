-- Ejecutar en Supabase > SQL Editor. Se puede repetir sin duplicar datos.

-- Administradores (agrega aquí los correos de admin)
insert into usuarios (correo_institucional, rol)
values ('fernando.herrero@correo.unimet.edu.ve', 'ADMINISTRADOR')
on conflict (correo_institucional) do update set rol = 'ADMINISTRADOR';

-- Cubículos: el id tiene formato piso-número ('1-3' = piso 1, cubículo 3). 2 pisos x 6 cubículos.
insert into cubiculos (id)
select p || '-' || n
from generate_series(1, 2) p, generate_series(1, 6) n
on conflict (id) do nothing;
