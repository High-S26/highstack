-- Nutzer: Anmeldung per E-Mail-Link, Zuordnung zu einem Mandanten
create table if not exists nutzer (
  email text primary key,
  tenant_id text not null,
  daten jsonb not null,
  erstellt timestamptz not null default now()
);
create index if not exists nutzer_tenant on nutzer (tenant_id);
