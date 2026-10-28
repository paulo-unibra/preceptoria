# Deploy da API (preceptoria.bibliafoco.com.br)

Push na `main` (alterando `api/**`) dispara `.github/workflows/deploy-api.yml`:
testes → build → envio do pacote por SSH → `deploy.sh` no servidor (npm ci, migrations,
restart do serviço, health-check e rollback automático se falhar).

Servidor (146.190.138.248):
- `/opt/preceptoria/{releases,current,shared,bin/deploy}` — usuário `preceptoria`
- `/opt/preceptoria/shared/.env` — segredos de produção (fora do git); `shared/storage` (fotos) e `shared/backups`
- `systemctl status preceptoria` · `journalctl -u preceptoria -f` — serviço (`preceptoria.service`), porta 3340 local
- Apache faz o proxy HTTPS (`apache-preceptoria.conf`, certificado Let's Encrypt via certbot)
- PostgreSQL local (banco `preceptoria`); backup diário às 03:30 (`preceptoria-backup.cron`), 14 cópias
- A chave SSH de deploy só executa `bin/deploy` (`command=` no authorized_keys) e o SHA do commit é validado

Secrets do GitHub: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`.
Migrations novas rodam sozinhas no deploy; o rollback não desfaz migrations.
