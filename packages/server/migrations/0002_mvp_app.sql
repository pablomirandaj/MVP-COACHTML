-- 0002 — Ajustes para el MVP (ADR-019, ADR-020): login propio, escenas de fases, asistente.

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_hash text;

CREATE TABLE IF NOT EXISTS user_session (
  id          char(64) PRIMARY KEY,                 -- sha256 del token (el token en claro solo vive en la cookie)
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS user_session_user ON user_session(user_id);

-- Los comandos pueden venir de la interfaz o del asistente, no solo de una transcripción.
ALTER TABLE parsed_command ALTER COLUMN transcription_id DROP NOT NULL;
ALTER TABLE parsed_command ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUAL';

CREATE TABLE IF NOT EXISTS phase_scene (
  id             uuid PRIMARY KEY,
  team_id        uuid NOT NULL REFERENCES team(id),
  match_id       uuid REFERENCES match(id),
  name           text NOT NULL,
  spec           jsonb NOT NULL,                     -- fcs.scene spec (docs/32 §2)
  document       jsonb NOT NULL,                     -- escena calculada por el motor
  document_hash  char(64) NOT NULL,
  engine_version text NOT NULL,
  revision       integer NOT NULL DEFAULT 1,
  created_by     uuid NOT NULL REFERENCES app_user(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS phase_scene_team ON phase_scene(team_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS assistant_turn (
  id             uuid PRIMARY KEY,
  team_id        uuid NOT NULL REFERENCES team(id),
  user_id        uuid NOT NULL REFERENCES app_user(id),
  target_type    text NOT NULL CHECK (target_type IN ('TACTICAL_PLAY','PHASE_SCENE','LINEUP')),
  target_id      uuid NOT NULL,
  message        text NOT NULL,
  reply          text,
  commands       jsonb NOT NULL DEFAULT '[]'::jsonb,
  clarification  jsonb,
  provider       text NOT NULL,
  model          text NOT NULL,
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistant_turn_target ON assistant_turn(target_type, target_id, created_at);
