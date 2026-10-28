-- Base compartida del Observatorio Metalúrgico (Supabase, plan gratuito)
-- 1. Creá un proyecto en https://supabase.com
-- 2. Abrí "SQL Editor", pegá este archivo y ejecutalo
-- 3. En Project Settings → API copiá "Project URL" y la clave "anon public" en js/config.js
-- 4. Creá los usuarios de cada seccional en Authentication → Users (la carga exige sesión)

create table if not exists plantas (
  id text primary key, nombre text not null, empresa text, rama text,
  provincia text, partido text, localidad text, seccional text,
  lat double precision, lon double precision, convenio text default 'CCT 260/75',
  ubicacion text, seccional_confirmada boolean default false,
  cargado timestamptz default now()
);

create table if not exists reportes (
  id text primary key,                     -- planta_periodo
  "plantaId" text references plantas(id), periodo text not null,  -- AAAA-MM
  dotacion int, produccion numeric, unidad text, capacidad numeric,
  horas int, suspendidos int, contratados int, nota text,
  cargado timestamptz default now()
);

create table if not exists eventos (
  id text primary key, "plantaId" text references plantas(id),
  tipo text check (tipo in ('despidos','suspensiones','cierre','retiros','reincorporacion','conflicto')),
  fecha date not null, cantidad int, fuente text, url text, nota text,
  cargado timestamptz default now()
);

create table if not exists indicadores (
  id text primary key, serie text not null, nombre text, unidad text,
  periodo text not null, valor numeric, fuente text, url text
);

-- Lectura pública de lo agregado; escritura solo con usuario autenticado
alter table plantas enable row level security;
alter table reportes enable row level security;
alter table eventos enable row level security;
alter table indicadores enable row level security;

create policy "leer plantas" on plantas for select using (true);
create policy "leer reportes" on reportes for select using (true);
create policy "leer eventos" on eventos for select using (true);
create policy "leer indicadores" on indicadores for select using (true);

create policy "cargar plantas" on plantas for all to authenticated using (true) with check (true);
create policy "cargar reportes" on reportes for all to authenticated using (true) with check (true);
create policy "cargar eventos" on eventos for all to authenticated using (true) with check (true);
create policy "cargar indicadores" on indicadores for all to authenticated using (true) with check (true);

-- Si preferís que los reportes de planta NO sean públicos, borrá "leer reportes"
-- y reemplazala por: create policy "leer reportes" on reportes for select to authenticated using (true);
