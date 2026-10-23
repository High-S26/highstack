-- Plattformweite Ablage: Marktberichte, Anfragen, Protokoll, Verbrauch, Einstellungen
create table if not exists global_daten (
  art text not null,
  id text not null,
  daten jsonb not null,
  geaendert timestamptz not null default now(),
  primary key (art, id)
);
create index if not exists global_daten_art on global_daten (art, geaendert desc);
