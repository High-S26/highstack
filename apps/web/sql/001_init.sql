-- highstack: Grundschema. Jede Zeile gehört zu einem Mandanten (tenant_id).
create table if not exists profil (
  tenant_id text primary key,
  daten jsonb not null,
  geaendert timestamptz not null default now()
);
create table if not exists objekte (
  id text primary key,
  tenant_id text not null,
  daten jsonb not null,
  geaendert timestamptz not null default now()
);
create index if not exists objekte_tenant on objekte (tenant_id);
create table if not exists dateien (
  id text primary key,
  tenant_id text not null,
  objekt_id text not null,
  name text not null,
  mime text not null,
  inhalt bytea not null,
  erstellt timestamptz not null default now()
);
create index if not exists dateien_objekt on dateien (tenant_id, objekt_id);
