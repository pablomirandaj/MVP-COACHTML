-- 0003 — Pizarra Studio: piezas (pizarra, balón parado, plan de juego) con revisión para detectar conflictos.
CREATE TABLE IF NOT EXISTS studio_item (
  id            text PRIMARY KEY CHECK (id ~ '^[a-z0-9_]{3,64}$'),
  team_id       uuid NOT NULL REFERENCES team(id),
  kind          text NOT NULL CHECK (kind IN ('BOARD', 'SETPIECE', 'SCENE')),
  title         text NOT NULL,
  match_number  integer,                 -- jornada (el calendario puede venir de la federación, no de la tabla match)
  opponent      text,
  doc           jsonb NOT NULL,
  history       jsonb NOT NULL DEFAULT '[]',
  revision      integer NOT NULL DEFAULT 1,
  created_by    uuid REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS studio_item_team ON studio_item(team_id, updated_at DESC) WHERE deleted_at IS NULL;
