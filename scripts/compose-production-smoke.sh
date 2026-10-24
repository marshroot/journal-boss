#!/usr/bin/env bash
set -euo pipefail

# Run from repository root after `docker compose up -d`.
# P49 is local-only: backend/collab stay internal and frontend is bound to 127.0.0.1:3000.
fail=0
check() {
  local name="$1"; shift
  if "$@" >/tmp/jornal-smoke.out 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    cat /tmp/jornal-smoke.out
    fail=1
  fi
}

check "backend health" docker compose exec -T backend curl -fsS http://127.0.0.1:8080/health
check "frontend health" docker compose exec -T frontend wget -qO- http://127.0.0.1/health
check "collab tcp" docker compose exec -T collab node -e "const net=require('net'); const s=net.connect(1234,'127.0.0.1',()=>{s.end();process.exit(0)}); s.on('error',()=>process.exit(1)); setTimeout(()=>process.exit(1),5000)"

# Verify the local frontend entry point; no public proxy or domain is started in P50.
check "localhost frontend response" curl -fsS -o /tmp/jornal-frontend.out -D /tmp/jornal-frontend.headers http://127.0.0.1:3000/

echo "--- compose status ---"
docker compose ps

if [ "$fail" -ne 0 ]; then
  echo "Production smoke failed."
  exit 1
fi
echo "All local Compose smoke checks passed."
