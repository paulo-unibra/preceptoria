# Preceptoria — API

API do sistema de **Acompanhamento Escolar (Preceptoria)**, baseada no documento
*"Preceptoria - Acompanhamento escolar"* (especificação de requisitos, Etapa 2).

- **AdonisJS 6** (Node ≥ 20.6) · Lucid ORM · VineJS · autenticação por token de acesso
- **SQLite** no desenvolvimento · **PostgreSQL** em produção
- Relatórios em **PDF** (pdfkit) com a identidade visual da Secretaria de Educação de Itapissuma-PE
- Todas as mensagens ao usuário em português; payloads e respostas em `snake_case`

> Usamos AdonisJS **6** porque o AdonisJS 7 exige Node 24. Para migrar, basta atualizar o Node e o framework.

## Como rodar

```bash
cd api
npm install
cp .env.example .env            # e gere a chave:  node ace generate:key
node ace migration:run
node ace db:seed                # admin, códigos RA 01–21 e (em dev) dados de demonstração
npm run dev                     # http://localhost:3333
```

Usuários de demonstração (somente `NODE_ENV=development`), senha `Preceptoria@2026`:
`admin@preceptoria.local`, `coordenacao@preceptoria.local`, `preceptor@preceptoria.local`.

| Comando | O que faz |
|---|---|
| `npm test` | Suíte completa (71 testes; usa banco SQLite separado e o desfaz ao final) |
| `npm run typecheck` / `npm run lint` | Verificações estáticas |
| `node ace backup:run` | Cópia de segurança do banco (ver abaixo) |
| `node ace build` | Build de produção em `build/` |

### Variáveis de ambiente

Veja `.env.example`. Em produção use `DB_CONNECTION=pg` (+ `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_DATABASE`) e `LIMITER_STORE=database`. Sem `ADMIN_PASSWORD`, o seeder gera uma
senha aleatória para o administrador inicial e a exibe **uma única vez**.

## Perfis e acesso (RF-01, RNF02)

| Perfil | Pode |
|---|---|
| **preceptor** | Lançar frequência, checklist, aulas, RAs, notificações, observações e encaminhamentos **nas turmas vinculadas a ele**; consultar histórico e gerar relatórios dessas turmas |
| **coordenacao** | Somente consulta nas turmas sob sua gestão; acompanhar/atualizar encaminhamentos; revisar duplicidades; auditoria e relatórios |
| **admin** | Tudo: usuários, vínculos usuário↔turma, turmas, estudantes, responsáveis, fotos, tabela de RAs, configurações (ranking e privacidade) e correções |

O vínculo usuário↔turma é feito em `PUT /users/:id/classrooms`. Quem não está vinculado recebe `403`.

## Endpoints (prefixo `/api/v1`)

Autenticação por `Authorization: Bearer <token>` (exceto o login).

| Área | Rotas |
|---|---|
| Auth | `POST auth/login` · `POST auth/logout` · `GET auth/me` · `PUT auth/password` |
| Usuários (admin) | `GET/POST users` · `GET/PATCH users/:id` · `PUT users/:id/classrooms` |
| Turmas / enturmação | `GET classrooms` · `GET classrooms/:id` · `GET classrooms/:id/students` · `POST/PATCH` (admin) |
| Estudantes / ficha | `GET students?q=&classroom_id=` · `GET students/:id` · `GET students/:id/photo` · admin: `POST/PATCH students`, `POST students/:id/photo`, `POST/PATCH students/:id/guardians` |
| Frequência | `GET attendances/roster?classroom_id&date` · `PUT attendances/bulk` · `GET attendances?…` |
| Checklist | `GET uniform-checks/roster` · `PUT uniform-checks/bulk` · `GET uniform-checks` |
| Aulas | `PUT lesson-days` (cria/atualiza o dia e os tempos) · `GET lesson-days` · `GET lesson-days/:id` |
| RAs / ocorrências | `GET ra-codes` · `GET/POST occurrences` · `GET/PATCH occurrences/:id` · `POST occurrences/:id/cancel` · `POST occurrences/:id/review-duplicate` · `POST occurrences/:id/resolve-divergence` (admin) |
| Notificações | `GET/POST notifications` · `GET/PATCH notifications/:id` · `POST notifications/:id/cancel` |
| Observações | `GET/POST observations` · `PATCH observations/:id` · `POST observations/:id/cancel` |
| Encaminhamentos | `GET/POST referrals` · `GET/PATCH referrals/:id` · `POST referrals/:id/cancel` |
| Histórico individual | `GET students/:id/history?from&to&types=&include_cancelled=` |
| Relatórios | `GET reports/students/:id` · `GET reports/classrooms/:id` — JSON, ou PDF com `?format=pdf` |
| Ranking | `GET ranking?kind=weekly\|biweekly&end=&classroom_id=` · `GET ranking/criteria` |
| Auditoria | `GET audit-logs?entity=&entity_id=&classroom_id=` (admin/coordenação) |
| Configurações (admin) | `GET settings` · `PUT settings/ranking` · `PUT settings/privacy` · `PATCH ra-codes/:code` |

Erros seguem sempre `{ "errors": [{ "message": "...", "code": "E_...", "field": "..." }] }`.

## Regras de negócio e critérios de aceite → onde estão

| Regra | Implementação |
|---|---|
| RN01 / RN02 / CA01 — RA 01–09 positivo, 10–21 negativo; **09 nunca negativo** | `app/support/ra.ts` + hook `beforeSave` em `app/models/occurrence.ts`. O cliente **não** envia polaridade: o servidor deriva do código |
| RN03 / CA02 — registro antigo divergente: preserva o original e sinaliza | `source = 'legacy'` mantém a polaridade gravada e marca `polarity_divergent`; aparece em `occurrences?needs_review=true`; o admin resolve em `resolve-divergence` (valor anterior fica na auditoria) |
| RN04 — data do fato ≠ data de cadastro | `occurred_on` (data do acontecimento) × `created_at` |
| RN05 / RNF04 / CA03 / CA05 — totais e detalhes coerentes | `app/services/history_service.ts`: **uma só busca** de registros por escopo/período/filtros; totais e detalhes (JSON e PDF) saem dessa mesma coleção |
| RN06 / CA04 — notificação vinculada não cria outra ocorrência | `notifications.occurrence_id` é só referência; contagens separadas |
| RN07 — faltas, notificações e RAs contados separadamente | `totals.attendance`, `totals.notifications`, `totals.occurrences` |
| RN08 — duplicidade sinalizada, sem exclusão automática | `possible_duplicate_of_id` + `review-duplicate`; nada é apagado |
| CA06 / RNF03 — rastreabilidade | `AuditedModel` (hooks) grava `created_by`/`updated_by` e um `audit_logs` com valor anterior, novo valor, autor e data em **toda** criação/alteração |
| RF-07 — "Não identificado" | Aula marcada assim **não aceita** conteúdo/andamento (evita inventar dado) e pode ter motivo; aparece à parte nos relatórios |
| RF-03 — ranking transparente e configurável | `GET ranking/criteria`; pesos em `PUT settings/ranking`; só os destaques são listados; considera **progresso** frente ao período anterior |
| RNF02 — privacidade | Escopo por turma em toda consulta; foto só por rota autenticada; fotos/telefones por perfil via `PUT settings/privacy`; encaminhamento confidencial restrito |

## Premissas adotadas nas decisões pendentes (a confirmar com o cliente)

| # | Decisão | Premissa implementada |
|---|---|---|
| DP01 | Uma turma, várias turmas ou várias escolas? | **Várias turmas, uma escola.** Multi-escola exigiria uma entidade `school` e o escopo por escola |
| DP02 | Faltas por dia ou por aula? | **Por dia** (um registro por estudante/data). Frequência por aula exigiria ligar `attendances` a `lessons` |
| DP03 | Notificações só registradas ou enviadas? | **Só registradas**; `guardian_informed` indica que a família foi avisada fora do sistema. Não há envio |
| DP04 | Quem corrige e como cancela? | Corrige/cancela **quem criou** (se ainda tem acesso à turma) **ou o admin**. Coordenação é somente leitura. Cancelamento **lógico**, com motivo obrigatório; nada é apagado |
| DP05 | Descrição oficial dos códigos RA | **Não presumida**: `ra_codes.description` fica `null` até o admin informar. Só a polaridade (faixa) é fixa |
| DP06 | Perfis e turmas | Três perfis acima; acesso por vínculo usuário↔turma. **Estudantes e responsáveis não têm acesso** |
| DP07 | Importação de registros anteriores | **Fora do MVP.** O modelo já suporta `source = 'legacy'` com a sinalização de divergência para quando existir |
| DP08 | Metas de desempenho/disponibilidade/recuperação | **A definir.** Backup implementado (abaixo); sem metas numéricas |

Além disso, para "Etapa 3" do documento, **encaminhamentos** (RF-11) já estão incluídos, embora o MVP os deixe fora do compromisso inicial.

## Backup e restauração (RNF05)

```bash
node ace backup:run                 # gera backups/preceptoria-<data>.sqlite3 (ou .dump no PostgreSQL)
node ace backup:run --keep=30       # retenção (padrão: 14 cópias)
```

- **SQLite:** usa a API de backup do SQLite (cópia consistente, pode rodar com o servidor no ar).
- **PostgreSQL:** usa `pg_dump -Fc` (o utilitário precisa estar instalado).
- Agende no `cron` (ex.: diariamente) e **copie `backups/` e `storage/` (fotos) para outro local**.

**Restaurar**

1. Pare o servidor.
2. SQLite: substitua o arquivo do banco (`tmp/db.sqlite3` ou `DB_FILENAME`) pela cópia escolhida.
   PostgreSQL: `pg_restore --clean --if-exists -d preceptoria backups/<arquivo>.dump`.
3. Restaure a pasta `storage/` (fotos) correspondente.
4. Suba o servidor e confira `GET /health`.

Teste a restauração periodicamente: um backup que nunca foi restaurado não é garantia.

## Identidade visual

As cores dos relatórios em PDF (`app/support/brand.ts`) e do app (`src/constants/theme.ts`) vêm da
logo da Secretaria de Educação de Itapissuma (azul-marinho `#141B47`, azul-céu `#549CCC`, verde `#2F9A55`,
marrom `#6C4A3C`). A logo usada no PDF é `resources/logo.jpeg` (copiada no build via `metaFiles`).

## Pendências conhecidas

- Metas numéricas de desempenho/disponibilidade (DP08) e modelos oficiais de relatório da escola/município.
- Gráficos e comparação entre períodos (RF-10) — a API já devolve totais por período; os gráficos ficam para o app.
- Importação de registros antigos (DP07) e envio de notificações aos responsáveis (DP03).
