-- 0004 — Pizarra Studio: ficha de cada jugada y reglas fijas de la carpeta del partido («Esto no cambia nunca»).
ALTER TABLE studio_item ADD COLUMN IF NOT EXISTS sheet jsonb;
CREATE TABLE IF NOT EXISTS studio_settings (
  team_id     uuid PRIMARY KEY REFERENCES team(id),
  rules       jsonb NOT NULL DEFAULT '[]',
  updated_by  uuid REFERENCES app_user(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
