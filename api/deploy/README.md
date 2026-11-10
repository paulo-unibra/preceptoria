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

## Dashboard e APK

- O dashboard é estático, servido em `https://preceptoria.bibliafoco.com.br/dashboard/`.
- Gere o build em `dashboard/` com `VITE_API_URL=https://preceptoria.bibliafoco.com.br VITE_BASE_PATH=/dashboard/ npm run build`, após lint e typecheck.
- Cada publicação fica em `/var/www/preceptoria/releases/<hash>/`; `/var/www/preceptoria/dashboard` aponta para a release ativa. Envie o conteúdo de `dashboard/dist/` e altere o link somente após concluir o envio. Para rollback, restaure o link anterior.
- O APK assinado fica em `/var/www/preceptoria/downloads/preceptoria-nfc.apk`, disponível em `/downloads/preceptoria-nfc.apk`. Confirme a assinatura original e a permissão NFC antes de substituir o arquivo; use nome temporário e renomeação após completar o envio.
- Instale `apache-preceptoria-static.conf` em `/etc/apache2/conf-available/preceptoria-static.conf` e inclua dentro dos VirtualHosts HTTP/HTTPS **antes** de `ProxyPass /`. O snippet faz as exclusões do proxy, os aliases, o fallback das rotas React e o cache dos assets. Ele não deve ser habilitado globalmente com `a2enconf`.
- Rode `apache2ctl configtest` antes de recarregar o Apache. A configuração do proxy usa timeout de 180 segundos para permitir importação de fichas.
- A chave restrita do workflow publica somente a API. A publicação dos arquivos estáticos usa acesso administrativo ao servidor.
