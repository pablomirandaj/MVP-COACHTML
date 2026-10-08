-- =============================================================================
-- Football Coach Studio — esquema MVP (PostgreSQL 16)
-- Estado: DISEÑADO. Migración inicial prevista: 0001_init.sql (Drizzle Kit).
-- Convenciones:
--   * PK uuid v7 (ordenables en el tiempo) generadas en la aplicación.
--   * created_at / updated_at timestamptz; borrado lógico con deleted_at donde aplica.
--   * Toda tabla de negocio lleva team_id o club_id para RLS (defensa en profundidad).
--   * Documentos tácticos en JSONB validados por JSON Schema en la aplicación.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- búsqueda difusa de jugadores/rivales

-- ---------- Tipos ------------------------------------------------------------
CREATE TYPE foot            AS ENUM ('RIGHT','LEFT','BOTH');
CREATE TYPE player_status   AS ENUM ('AVAILABLE','INJURED','SUSPENDED','UNAVAILABLE','DOUBTFUL');
CREATE TYPE team_role       AS ENUM ('CLUB_ADMIN','HEAD_COACH','ASSISTANT_COACH','ANALYST','PLAYER','GUARDIAN');
CREATE TYPE match_status    AS ENUM ('SCHEDULED','POSTPONED','PLAYED','CANCELLED','BYE');
CREATE TYPE publish_state   AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE play_type       AS ENUM ('CORNER_ATT','CORNER_DEF','FK_WIDE_ATT','FK_WIDE_DEF','FK_CENTRAL_ATT','FK_CENTRAL_DEF','FK_INDIRECT_ATT','FK_INDIRECT_DEF','THROW_IN_ATT','THROW_IN_DEF','KICKOFF','CUSTOM');
CREATE TYPE command_source  AS ENUM ('VOICE','TEXT','MANUAL','CLARIFICATION');
CREATE TYPE command_status  AS ENUM ('PARSED','NEEDS_CLARIFICATION','APPLIED','REJECTED','UNDONE');
CREATE TYPE analysis_category AS ENUM ('SYSTEM','OFFENSIVE_ORG','DEFENSIVE_ORG','PRESSING','TRANSITIONS','STRENGTH','WEAKNESS','SET_PIECES_ATT','SET_PIECES_DEF','KEY_PLAYERS','COACH_RECOMMENDATION','OTHER');
CREATE TYPE evidence_status AS ENUM ('OBSERVED','HYPOTHESIS','CONFIRMED','REFUTED');
CREATE TYPE resource_type   AS ENUM ('LINEUP','TACTICAL_PLAY','MATCH_PLAN','PRESENTATION','SQUAD_CALL','INDIVIDUAL_INSTRUCTION','OPPONENT_EXTRACT');
CREATE TYPE audience_type   AS ENUM ('TEAM_PLAYERS','STAFF','PLAYERS_LIST','PUBLIC_LINK');

-- ---------- Identidad y organización -----------------------------------------
CREATE TABLE app_user (
  id              uuid PRIMARY KEY,
  email           citext NOT NULL UNIQUE,
  display_name    text NOT NULL,
  locale          text NOT NULL DEFAULT 'es-ES',
  direction_frame text NOT NULL DEFAULT 'ATTACKING_TEAM' CHECK (direction_frame IN ('ATTACKING_TEAM','SCREEN')),
  birth_date      date,                                 -- solo para cuentas de jugador (verificación de edad)
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
-- "Menor de 14" se calcula en la aplicación (birth_date > hoy - 14 años); no puede ser columna generada
-- porque CURRENT_DATE no es inmutable. Ver docs/21 §5.

CREATE TABLE club (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  crest_file  uuid,
  country     char(2) NOT NULL DEFAULT 'ES',
  plan        text NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE','COACH','CLUB')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE season (
  id          uuid PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES club(id),
  label       text NOT NULL,                -- '2026/27'
  starts_on   date NOT NULL,
  ends_on     date NOT NULL CHECK (ends_on > starts_on),
  UNIQUE (club_id, label)
);

CREATE TABLE team (
  id               uuid PRIMARY KEY,
  club_id          uuid NOT NULL REFERENCES club(id),
  season_id        uuid NOT NULL REFERENCES season(id),
  name             text NOT NULL,
  category         text NOT NULL,           -- 'Senior', 'Juvenil A', 'Cadete B'...
  is_youth         boolean NOT NULL DEFAULT false,
  crest_file       uuid,
  pitch_length_m   numeric(5,2) NOT NULL DEFAULT 105 CHECK (pitch_length_m BETWEEN 90 AND 120),
  pitch_width_m    numeric(5,2) NOT NULL DEFAULT 68  CHECK (pitch_width_m BETWEEN 45 AND 90),
  preferences      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- intensidades, fill_order, preferencias de rol (TEAM_PREF)
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX team_club_idx ON team(club_id) WHERE deleted_at IS NULL;

CREATE TABLE team_membership (               -- también "StaffMember" para roles de cuerpo técnico
  id          uuid PRIMARY KEY,
  team_id     uuid NOT NULL REFERENCES team(id),
  user_id     uuid NOT NULL REFERENCES app_user(id),
  role        team_role NOT NULL,
  staff_title text,                          -- 'Preparador físico', 'Entrenador de porteros'
  player_id   uuid,                          -- si role = PLAYER o GUARDIAN (FK más abajo)
  invited_by  uuid REFERENCES app_user(id),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  UNIQUE (team_id, user_id, role)
);
CREATE INDEX membership_user_idx ON team_membership(user_id) WHERE revoked_at IS NULL;

CREATE TABLE club_admin (
  club_id uuid NOT NULL REFERENCES club(id),
  user_id uuid NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE preferred_formation (
  team_id      uuid NOT NULL REFERENCES team(id),
  formation_id uuid NOT NULL,                -- FK más abajo
  rank         smallint NOT NULL,
  PRIMARY KEY (team_id, formation_id)
);

-- ---------- Plantilla ---------------------------------------------------------
CREATE TABLE player (
  id              uuid PRIMARY KEY,
  team_id         uuid NOT NULL REFERENCES team(id),
  first_name      text NOT NULL,
  last_name       text NOT NULL DEFAULT '',
  nickname        text,
  shirt_number    smallint CHECK (shirt_number BETWEEN 1 AND 99),
  photo_file      uuid,                      -- solo con consentimiento (consent.kind = 'PHOTO')
  dominant_foot   foot NOT NULL DEFAULT 'RIGHT',
  height_cm       smallint CHECK (height_cm BETWEEN 120 AND 220),
  birth_year      smallint,                  -- solo año: minimización
  status          player_status NOT NULL DEFAULT 'AVAILABLE',
  status_note     text,
  coach_notes     text,                      -- privado del cuerpo técnico
  phonetic_key    text NOT NULL,             -- clave fonética para el NLU (docs/16 §6.1)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX player_shirt_uq ON player(team_id, shirt_number) WHERE deleted_at IS NULL AND shirt_number IS NOT NULL;
CREATE INDEX player_name_trgm ON player USING gin ((first_name || ' ' || last_name || ' ' || coalesce(nickname,'')) gin_trgm_ops);

ALTER TABLE team_membership ADD CONSTRAINT membership_player_fk FOREIGN KEY (player_id) REFERENCES player(id);

CREATE TABLE player_position (
  player_id   uuid NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  position    text NOT NULL CHECK (position IN ('GK','RB','LB','RWB','LWB','CB','DM','CM','RM','LM','AM','RW','LW','ST','SS')),
  is_primary  boolean NOT NULL DEFAULT false,
  rank        smallint NOT NULL DEFAULT 1,
  PRIMARY KEY (player_id, position)
);
CREATE UNIQUE INDEX player_one_primary ON player_position(player_id) WHERE is_primary;

CREATE TABLE player_attribute (             -- características futbolísticas extensibles (tags)
  player_id uuid NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  key       text NOT NULL,                   -- 'aerial','pace','physical','long_shot','technical','finishing','set_piece_specialist'
  value     smallint NOT NULL DEFAULT 1 CHECK (value BETWEEN 0 AND 5),
  PRIMARY KEY (player_id, key)
);

CREATE TABLE player_setpiece_role (
  player_id uuid NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  role_key  text NOT NULL,                   -- 'corner_taker_left','corner_taker_right','fk_taker','primary_target','blocker'
  PRIMARY KEY (player_id, role_key)
);

-- ---------- Competición, calendario, rivales -----------------------------------
CREATE TABLE competition (
  id         uuid PRIMARY KEY,
  team_id    uuid NOT NULL REFERENCES team(id),
  name       text NOT NULL,                  -- 'Primera Regional Grupo 3', 'Copa Federación'
  kind       text NOT NULL DEFAULT 'LEAGUE' CHECK (kind IN ('LEAGUE','CUP','FRIENDLY','TOURNAMENT')),
  season_id  uuid NOT NULL REFERENCES season(id)
);

CREATE TABLE opponent (
  id            uuid PRIMARY KEY,
  club_id       uuid NOT NULL REFERENCES club(id),   -- el histórico pertenece al club, no a la temporada
  name          text NOT NULL,
  normalized    text NOT NULL,                       -- minúsculas sin tildes para búsqueda y deduplicación
  crest_file    uuid,
  usual_formation text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, normalized)
);
CREATE INDEX opponent_trgm ON opponent USING gin (normalized gin_trgm_ops);

CREATE TABLE matchday (
  id              uuid PRIMARY KEY,
  competition_id  uuid NOT NULL REFERENCES competition(id),
  number          smallint,                 -- NULL para amistosos
  label           text NOT NULL,            -- 'Jornada 5'
  UNIQUE (competition_id, number)
);

CREATE TABLE match (
  id             uuid PRIMARY KEY,
  team_id        uuid NOT NULL REFERENCES team(id),
  matchday_id    uuid REFERENCES matchday(id),
  opponent_id    uuid REFERENCES opponent(id),       -- NULL si BYE (jornada sin partido)
  status         match_status NOT NULL DEFAULT 'SCHEDULED',
  kickoff_at     timestamptz,
  original_kickoff_at timestamptz,                  -- para aplazados
  is_home        boolean,
  venue          text,
  goals_for      smallint,
  goals_against  smallint,
  objectives     text,
  training_notes text,
  post_match_notes text,
  formation_id   uuid,                               -- sistema previsto
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'BYE' OR opponent_id IS NULL)
);
CREATE INDEX match_team_date_idx ON match(team_id, kickoff_at);
CREATE INDEX match_opponent_idx ON match(opponent_id);

CREATE TABLE squad_call (                            -- convocatoria
  match_id   uuid NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES player(id),
  called     boolean NOT NULL DEFAULT true,
  note       text,
  PRIMARY KEY (match_id, player_id)
);

-- ---------- Formaciones y alineaciones -----------------------------------------
CREATE TABLE formation (
  id          uuid PRIMARY KEY,
  team_id     uuid REFERENCES team(id),     -- NULL = catálogo del sistema
  code        text NOT NULL,                -- 'F_433' o 'custom:...'
  label       text NOT NULL,
  is_custom   boolean NOT NULL DEFAULT false,
  base_code   text,
  slots       jsonb NOT NULL,               -- [{slot,u,v}] (docs/engine/rules/formations.yaml)
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, code)
);
ALTER TABLE preferred_formation ADD CONSTRAINT pf_formation_fk FOREIGN KEY (formation_id) REFERENCES formation(id);
ALTER TABLE match ADD CONSTRAINT match_formation_fk FOREIGN KEY (formation_id) REFERENCES formation(id);

CREATE TABLE lineup (
  id            uuid PRIMARY KEY,
  team_id       uuid NOT NULL REFERENCES team(id),
  match_id      uuid REFERENCES match(id),
  formation_id  uuid NOT NULL REFERENCES formation(id),
  label         text NOT NULL DEFAULT 'Once inicial',
  tags          text[] NOT NULL DEFAULT '{}',
  is_primary    boolean NOT NULL DEFAULT false,    -- once oficial del partido
  state         publish_state NOT NULL DEFAULT 'DRAFT',
  revision      integer NOT NULL DEFAULT 1,        -- bloqueo optimista
  slot_overrides jsonb NOT NULL DEFAULT '{}'::jsonb, -- desplazamientos de ranuras {slot:{u,v}} (adelantar, juntar líneas)
  created_by    uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX lineup_one_primary ON lineup(match_id) WHERE is_primary AND deleted_at IS NULL;
CREATE INDEX lineup_team_tags ON lineup USING gin (tags);

CREATE TABLE lineup_assignment (
  lineup_id   uuid NOT NULL REFERENCES lineup(id) ON DELETE CASCADE,
  slot        text NOT NULL,
  player_id   uuid NOT NULL REFERENCES player(id),
  provenance  text NOT NULL DEFAULT 'EXPLICIT',    -- EXPLICIT | INFERRED | MANUAL
  PRIMARY KEY (lineup_id, slot),
  UNIQUE (lineup_id, player_id)                    -- LINEUP-02: un jugador, una ranura
);

-- ---------- Jugadas tácticas ---------------------------------------------------
CREATE TABLE tactical_play (
  id              uuid PRIMARY KEY,
  team_id         uuid NOT NULL REFERENCES team(id),
  type            play_type NOT NULL,
  name            text NOT NULL,
  variant_of      uuid REFERENCES tactical_play(id),
  current_version integer NOT NULL DEFAULT 0,
  state           publish_state NOT NULL DEFAULT 'DRAFT',
  tags            text[] NOT NULL DEFAULT '{}',
  created_by      uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX play_team_type ON tactical_play(team_id, type) WHERE deleted_at IS NULL;

CREATE TABLE tactical_play_version (               -- inmutable
  play_id         uuid NOT NULL REFERENCES tactical_play(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  document        jsonb NOT NULL,                   -- fcs.play/1
  document_hash   char(64) NOT NULL,                -- sha256 canónico
  engine_version  text NOT NULL,
  catalog_version text NOT NULL,
  parent_version  integer,
  created_by      uuid NOT NULL REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (play_id, version)
);

-- Proyecciones relacionales del documento (lectura/búsqueda; se regeneran al guardar versión)
CREATE TABLE tactical_role (
  play_id     uuid NOT NULL,
  version     integer NOT NULL,
  actor_id    text NOT NULL,
  team_side   text NOT NULL CHECK (team_side IN ('OWN','OPP')),
  role        text NOT NULL,
  player_id   uuid REFERENCES player(id),
  provenance  text NOT NULL,
  PRIMARY KEY (play_id, version, actor_id),
  FOREIGN KEY (play_id, version) REFERENCES tactical_play_version(play_id, version) ON DELETE CASCADE
);
CREATE INDEX tactical_role_player ON tactical_role(player_id);     -- "¿en qué jugadas participa Lucas?"

CREATE TABLE tactical_movement (
  play_id     uuid NOT NULL,
  version     integer NOT NULL,
  movement_id text NOT NULL,
  actor_id    text NOT NULL,
  type        text NOT NULL,
  t_start     numeric(6,3) NOT NULL,
  t_end       numeric(6,3) NOT NULL,
  PRIMARY KEY (play_id, version, movement_id),
  FOREIGN KEY (play_id, version, actor_id) REFERENCES tactical_role(play_id, version, actor_id) ON DELETE CASCADE
);

CREATE TABLE match_play (                           -- jugadas seleccionadas para una jornada
  match_id  uuid NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  play_id   uuid NOT NULL REFERENCES tactical_play(id),
  pinned_version integer,
  ord       smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, play_id)
);

-- ---------- Voz y comandos -----------------------------------------------------
CREATE TABLE voice_recording (
  id            uuid PRIMARY KEY,
  team_id       uuid NOT NULL REFERENCES team(id),
  user_id       uuid NOT NULL REFERENCES app_user(id),
  context       text NOT NULL,                     -- pantalla
  context_ref   uuid,                              -- match/play/lineup/analysis
  storage_key   text,                              -- NULL tras purga
  mime_type     text NOT NULL,
  duration_ms   integer NOT NULL CHECK (duration_ms BETWEEN 300 AND 300000),
  purge_after   timestamptz NOT NULL,              -- created_at + retención del equipo (def. 30 días)
  purged_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voice_purge_idx ON voice_recording(purge_after) WHERE purged_at IS NULL;

CREATE TABLE transcription (
  id            uuid PRIMARY KEY,
  recording_id  uuid REFERENCES voice_recording(id) ON DELETE SET NULL,  -- NULL si fue texto escrito
  team_id       uuid NOT NULL REFERENCES team(id),
  provider      text NOT NULL,                     -- 'deepgram-nova-3', 'whisper-self', 'typed'
  language      text NOT NULL DEFAULT 'es',
  raw_text      text NOT NULL,
  edited_text   text,                              -- si el entrenador corrige antes de interpretar
  segments      jsonb,                             -- [{start_ms,end_ms,text,confidence}]
  keyterms_used text[],
  latency_ms    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE parsed_command (
  id              uuid PRIMARY KEY,
  transcription_id uuid NOT NULL REFERENCES transcription(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES team(id),
  nlu_version     text NOT NULL,
  ir              jsonb NOT NULL,                  -- command-ir 1.0 (envoltorio completo)
  status          command_status NOT NULL,
  target_type     text,                            -- 'LINEUP' | 'TACTICAL_PLAY' | 'OPPONENT_ANALYSIS' | 'PRESENTATION'
  target_id       uuid,
  version_from    integer,
  version_to      integer,
  patch           jsonb,                           -- RFC 6902
  inverse_patch   jsonb,
  clarification_answers jsonb,
  applied_by      uuid REFERENCES app_user(id),
  applied_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parsed_cmd_target ON parsed_command(target_type, target_id, created_at);

-- ---------- Análisis de rivales -----------------------------------------------
CREATE TABLE opponent_analysis (
  id            uuid PRIMARY KEY,
  opponent_id   uuid NOT NULL REFERENCES opponent(id),
  team_id       uuid NOT NULL REFERENCES team(id),
  match_id      uuid REFERENCES match(id),         -- partido para el que se prepara
  source_kind   text NOT NULL CHECK (source_kind IN ('LIVE_OBSERVATION','VIDEO','REPORT_THIRD_PARTY','OWN_MATCH','OTHER')),
  source_detail text,                              -- "Vídeo J4 vs Atlético X", "Informe de Andrés"
  observed_on   date,                              -- fecha del partido observado
  author_id     uuid NOT NULL REFERENCES app_user(id),
  state         publish_state NOT NULL DEFAULT 'DRAFT',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analysis_opponent_idx ON opponent_analysis(opponent_id, observed_on DESC);

CREATE TABLE analysis_item (
  id              uuid PRIMARY KEY,
  analysis_id     uuid NOT NULL REFERENCES opponent_analysis(id) ON DELETE CASCADE,
  category        analysis_category NOT NULL,
  tags            jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {phase, formation, side, shirt, zone...}
  text            text NOT NULL,                        -- literal del entrenador (limpieza mínima)
  transcription_id uuid REFERENCES transcription(id),
  span_start      integer,
  span_end        integer,
  evidence        evidence_status NOT NULL DEFAULT 'OBSERVED',
  supersedes_id   uuid REFERENCES analysis_item(id),    -- "cambios detectados"
  conflict_with   uuid REFERENCES analysis_item(id),
  reviewed        boolean NOT NULL DEFAULT false,
  ord             smallint NOT NULL DEFAULT 0
);
CREATE INDEX analysis_item_cat ON analysis_item(analysis_id, category);

-- ---------- Presentaciones -----------------------------------------------------
CREATE TABLE match_presentation (
  id            uuid PRIMARY KEY,
  match_id      uuid NOT NULL REFERENCES match(id),
  team_id       uuid NOT NULL REFERENCES team(id),
  template      text NOT NULL DEFAULT 'standard-v1',
  outline       jsonb NOT NULL,                 -- [{section, enabled, ord, items:[{kind, ref_id|text, origin}]}]
  state         publish_state NOT NULL DEFAULT 'DRAFT',
  revision      integer NOT NULL DEFAULT 1,
  created_by    uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE export_job (
  id              uuid PRIMARY KEY,
  team_id         uuid NOT NULL REFERENCES team(id),
  presentation_id uuid REFERENCES match_presentation(id),
  play_id         uuid REFERENCES tactical_play(id),
  format          text NOT NULL CHECK (format IN ('PPTX','PDF','PNG','GIF','MP4')),
  status          text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','DONE','FAILED')),
  input_hash      char(64) NOT NULL,              -- reproducibilidad: misma entrada -> mismo archivo
  output_key      text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE UNIQUE INDEX export_cache ON export_job(input_hash, format) WHERE status = 'DONE';

-- ---------- Compartir y permisos ------------------------------------------------
CREATE TABLE shared_resource (
  id             uuid PRIMARY KEY,
  team_id        uuid NOT NULL REFERENCES team(id),
  resource_type  resource_type NOT NULL,
  resource_id    uuid NOT NULL,
  resource_version integer,                     -- se comparte una versión concreta
  audience       audience_type NOT NULL,
  message        text,
  link_token_hash char(64),                     -- solo PUBLIC_LINK (nunca en equipos is_youth)
  expires_at     timestamptz,
  published_by   uuid NOT NULL REFERENCES app_user(id),
  published_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz
);
CREATE INDEX shared_team_idx ON shared_resource(team_id, published_at DESC) WHERE revoked_at IS NULL;

CREATE TABLE shared_resource_recipient (
  shared_id  uuid NOT NULL REFERENCES shared_resource(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES player(id),
  viewed_at  timestamptz,
  PRIMARY KEY (shared_id, player_id)
);

CREATE TABLE permission (                       -- concesiones finas por elemento (además del rol)
  id            uuid PRIMARY KEY,
  team_id       uuid NOT NULL REFERENCES team(id),
  resource_type text NOT NULL,                  -- tabla o '*' para el equipo completo
  resource_id   uuid,                           -- NULL = todos los del tipo
  grantee_user  uuid NOT NULL REFERENCES app_user(id),
  action        text NOT NULL CHECK (action IN ('VIEW','EDIT','PUBLISH','DELETE','MANAGE')),
  granted_by    uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, resource_type, resource_id, grantee_user, action)
);

CREATE TABLE consent (
  id            uuid PRIMARY KEY,
  player_id     uuid NOT NULL REFERENCES player(id),
  kind          text NOT NULL CHECK (kind IN ('DATA_PROCESSING','PHOTO','PLAYER_ACCOUNT','VOICE_CORPUS')),
  granted_by    uuid NOT NULL REFERENCES app_user(id),   -- tutor si el jugador es menor de 14
  granted_as    text NOT NULL CHECK (granted_as IN ('SELF','GUARDIAN','CLUB_ON_BEHALF')),
  evidence      text,                                   -- referencia al documento firmado (club)
  granted_at    timestamptz NOT NULL DEFAULT now(),
  withdrawn_at  timestamptz
);

-- ---------- Auditoría -----------------------------------------------------------
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,
  team_id     uuid,
  action      text NOT NULL,           -- 'player.update', 'lineup.publish', 'share.create', 'export.download'
  entity      text NOT NULL,
  entity_id   uuid,
  diff        jsonb,                   -- antes/después (sin datos sensibles en claro)
  via         text,                    -- 'UI' | 'VOICE' | 'API' | 'SYSTEM'
  ip_hash     char(64)
);
CREATE INDEX audit_team_at ON audit_log(team_id, at DESC);

-- ---------- RLS (defensa en profundidad; la API aplica los permisos primero) -----
ALTER TABLE player ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_team_staff ON player
  USING (team_id IN (SELECT team_id FROM team_membership
                     WHERE user_id = current_setting('app.user_id')::uuid
                       AND revoked_at IS NULL
                       AND role IN ('HEAD_COACH','ASSISTANT_COACH','ANALYST','CLUB_ADMIN')));
-- (Políticas equivalentes para el resto de tablas con team_id; los jugadores acceden solo vía shared_resource.)
