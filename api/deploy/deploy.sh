#!/usr/bin/env bash
# Instalado em /opt/preceptoria/bin/deploy. É o ÚNICO comando que a chave SSH de deploy pode executar
# (authorized_keys com command="..."). Recebe o pacote (tar.gz do build) pela entrada padrão e
# o SHA do commit em SSH_ORIGINAL_COMMAND.
set -euo pipefail

BASE=/opt/preceptoria
SHA="${SSH_ORIGINAL_COMMAND:-}"
KEEP=3

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA inválido" >&2; exit 1; }

exec 9>"$BASE/.deploy.lock"
flock -n 9 || { echo "Já existe um deploy em andamento" >&2; exit 1; }

REL="$BASE/releases/$SHA"
PREV="$(readlink -f "$BASE/current" 2>/dev/null || true)"

cleanup_failed() {
  echo "!! Deploy falhou" >&2
  if [[ -n "$PREV" && -d "$PREV" ]]; then
    echo "!! Voltando para $PREV" >&2
    ln -sfn "$PREV" "$BASE/current"
    sudo /usr/bin/systemctl restart preceptoria || true
  fi
  [[ "$REL" != "$PREV" ]] && rm -rf "$REL"
}
trap cleanup_failed ERR

echo "==> Extraindo release $SHA"
rm -rf "$REL"; mkdir -p "$REL"
tar -xzf - -C "$REL"

cd "$REL"
ln -sfn "$BASE/shared/.env" .env
ln -sfn "$BASE/shared/backups" backups
mkdir -p tmp

echo "==> Instalando dependências de produção"
nice -n 10 npm ci --omit=dev --no-audit --no-fund --loglevel=error

echo "==> Rodando migrations"
node ace.js migration:run --force

echo "==> Ativando release"
ln -sfn "$REL" "$BASE/current"
sudo /usr/bin/systemctl restart preceptoria

echo "==> Aguardando health-check"
ok=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3340/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[[ $ok -eq 1 ]] || { echo "Health-check não respondeu" >&2; false; }

trap - ERR
echo "==> Limpando releases antigas (mantendo $KEEP)"
cd "$BASE/releases"
ls -1t | tail -n +$((KEEP + 1)) | xargs -r rm -rf --
echo "==> Deploy OK: $SHA"
