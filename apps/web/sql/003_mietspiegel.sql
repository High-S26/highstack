-- Mietspiegel-Datenbasis: gemeinsam für alle Mandanten (öffentliche Daten), Pflege durch Datenverantwortliche
create table if not exists mietspiegel (
  id text primary key,
  stadt text not null,
  daten jsonb not null,
  geaendert timestamptz not null default now()
);
create index if not exists mietspiegel_stadt on mietspiegel (lower(stadt));
