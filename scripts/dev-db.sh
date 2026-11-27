#!/usr/bin/env bash
# Arranca (o reutiliza) un PostgreSQL 16 local para desarrollo y pruebas.
# Uso: scripts/dev-db.sh [directorio_datos]   → escucha en 127.0.0.1:55432, usuario postgres sin contraseña.
# Crea las bases fcs (desarrollo), fcs_test (pruebas de API) y fcs_e2e (pruebas extremo a extremo).
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="${1:-${PGDATA_DIR:-$HOME/.fcs-pg}}"
PORT="${PGPORT_DEV:-55432}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  # initdb no puede ejecutarse como root: se usa un usuario sin privilegios.
  id fcspg >/dev/null 2>&1 || useradd -m fcspg
  RUN_AS="fcspg"
  mkdir -p "$DATA" && chown -R fcspg "$DATA" && chmod 700 "$DATA"
  # El usuario sin privilegios tiene que poder atravesar las carpetas padre (no la de datos, que exige 0700).
  d="$(dirname "$DATA")"; while [ "$d" != "/" ]; do chmod o+x "$d" 2>/dev/null || true; d="$(dirname "$d")"; done
fi
run() { if [ -n "$RUN_AS" ]; then su "$RUN_AS" -c "$*"; else bash -c "$*"; fi; }
if [ ! -f "$DATA/PG_VERSION" ]; then run "$PGBIN/initdb -D '$DATA' -U postgres -A trust >/dev/null"; fi
if ! run "$PGBIN/pg_ctl -D '$DATA' status >/dev/null 2>&1"; then
  run "$PGBIN/pg_ctl -D '$DATA' -o '-p $PORT -k $DATA -c listen_addresses=127.0.0.1' -l '$DATA/log' -w start >/dev/null"
fi
for db in fcs fcs_test fcs_e2e; do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
    || psql -h 127.0.0.1 -p "$PORT" -U postgres -qc "CREATE DATABASE $db"
done
echo "PostgreSQL listo en postgres://postgres@127.0.0.1:$PORT (datos: $DATA)"
