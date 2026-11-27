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
| Importação (admin) | `GET/POST imports/students` · `GET imports/students/:id` · `GET students/:id/imported-profile` |
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

## Preceptoria no ChatGPT (MCP)

O servidor usa MCP Streamable HTTP em `/mcp` na mesma API. Os lançamentos são feitos na base existente, com o perfil do profissional, escopo por turma e auditoria por usuário. Não há banco separado, migração nova nem token compartilhado. A integração fica desabilitada sem `MCP_PUBLIC_URL`.

### Ativação

1. Configure `MCP_PUBLIC_URL` com a URL HTTPS exata de `/mcp` e `MCP_FIRST_PARTY_USERS` com os IDs das contas da Preceptoria autorizadas, separados por vírgula. Rode as migrations e reinicie a API. O proxy deve encaminhar `/mcp`, `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-protected-resource` (fallback), `/.well-known/oauth-authorization-server`, `/admin/acesso-personalizado` e `/oauth/*`. Preserve os cabeçalhos `Authorization`, `Accept`, `Origin` e `MCP-Protocol-Version`.
2. No workspace autorizado do ChatGPT, crie um app MCP privado usando a URL `/mcp` e OAuth detectado automaticamente. Se a interface pedir o método do cliente, use o **documento de metadados do cliente (CIMD)**, sem segredo. A Preceptoria aceita o cliente `https://chatgpt.com/oauth/client.json` e o retorno `https://chatgpt.com/connector_platform_oauth_redirect`. Os escopos são `preceptoria:read` e `preceptoria:write`.
3. Ao conectar, o ChatGPT abre **Acesso Personalizado**. Entre com a conta cadastrada na Preceptoria, confira as permissões e clique em **Aceitar e continuar**. Valide o fluxo com uma conta e turma de teste antes de usar registros reais. Desativar a conta ou trocar sua senha invalida o acesso; `DELETE /api/v1/auth/mcp` (com o token normal da Preceptoria) revoga os vínculos do usuário. Os tokens MCP são separados dos tokens da API.

**Alternativa — provedor OAuth externo:** deixe `MCP_FIRST_PARTY_USERS` indefinida e preencha `MCP_OAUTH_ISSUER`, `MCP_OAUTH_JWKS_URL` e `MCP_USER_LINKS` conforme [`.env.example`](.env.example). O provedor deve atender à [especificação do ChatGPT](https://developers.openai.com/apps-sdk/build/auth/) e emitir access tokens JWT RS256 ou ES256 com `iss`, `aud` igual à URL MCP, `sub`, `exp` e `scope` (separado por espaços). Confirme cada `sub` antes de associá-lo à conta existente.

### Ferramentas

| Ferramentas | Uso |
|---|---|
| `listar_turmas`, `buscar_estudantes` | Identificar a turma e o estudante no cadastro existente |
| `consultar_registros_do_dia`, `consultar_historico`, `listar_codigos_ra` | Consultar frequência/checklist, histórico paginado por período e catálogo de RAs |
| `salvar_frequencia`, `salvar_fardamento` | Cadastrar ou corrigir os registros informados, em lote por turma/data |
| `cadastrar_ra`, `editar_ra`, `cadastrar_observacao`, `editar_observacao` | Gravar e corrigir registros individuais; criação de RA usa o catálogo oficial |
| `consultar_diario_turma`, `salvar_aulas` | Consultar por período e cadastrar ou corrigir o diário de aulas por turma e data |
| `cadastrar_acontecimento_turma`, `editar_acontecimento_turma` | Gravar e corrigir atividades, interrupções e ocorrências institucionais da turma |

### Relatórios de aulas e ocorrências da turma

O diário usa as mesmas aulas registradas na API. Cada período confirmado pode receber disciplina, professor, conteúdo, andamento e observações. Ao corrigir, campos omitidos são preservados. Para criar o diário, informe a quantidade de aulas prevista, se confirmada na fonte. Não complete horários, disciplinas ou conteúdo que o relatório não informa.

Use acontecimentos da turma para registrar, por exemplo, recuperações sem horário identificado, parada pedagógica, ponto facultativo e gincana. Ocorrências institucionais são consultáveis pelo autor, pela coordenação da turma e por administradores. Relatos institucionais não entram na ficha disciplinar do estudante. Para os relatos individuais confirmados, use as ferramentas de observação ou RA, conforme o caso.

> Exemplo: “Compare o registro de aulas deste PDF com o diário da turma. Mostre as aulas com horários confirmados e os acontecimentos sem horário; aponte campos indefinidos e divergências antes de salvar.”

### Como usar os relatórios existentes

Pode-se anexar um relatório em uma conversa no workspace institucional autorizado e pedir uma prévia dos lançamentos por turma, estudante e data. O ChatGPT interpreta o anexo; o MCP recebe somente os campos selecionados para consulta ou gravação. **Não há importador automático do PDF de preceptoria**, nem ferramenta MCP para criar cadastros de estudantes ou guardar o PDF integral. O importador SGGE/Sicap abaixo é para outro formato.

> Exemplo: “Compare as presenças e faltas datadas deste relatório com o que já está cadastrado para a turma. Liste os lançamentos novos, as divergências e as linhas que precisam de conferência. Aguarde minha confirmação para salvar.”

- “Não discriminado” e “sem chamada” ficam sem lançamento. Saída antecipada e atividade externa não viram falta; quando pertinente, registre em observação. Só lance frequência com o horário de início da chamada verificado. Totais históricos sem datas individuais ficam como referência no relatório; não distribua o total em datas inventadas.
- Confira identidade, ano letivo, horários e divergências na fonte. Não transforme suspeitas ou códigos sugeridos em RAs formais. Registre como observação somente o fato verificado e necessário, sem detalhes pessoais ou de saúde dispensáveis.
- Ao revisar PDFs que cobrem os mesmos dias, consulte o histórico e não repita RAs/observações. A API sinaliza possíveis RAs duplicados. Frequência e checklist atualizam os registros dos alunos informados para o mesmo dia; ao corrigir, preserve o horário da turma e os campos que não precisam mudar.

## Cartões NFC

Preceptores da turma e administradores podem cadastrar cartões na ficha do aluno e registrar presença pela chamada. Todas as rotas exigem autenticação e verificam as permissões e o aluno ativo; novos cadastros e presenças exigem turma ativa. Execute `node ace migration:run` após atualizar.

| Rota | Operação |
|---|---|
| `GET students/:id/nfc-card` | Retorna somente `card.active` e `card.activated_at` |
| `POST students/:id/nfc-card/prepare` | Emite `token` aleatório (64 caracteres hexadecimais), com `expires_in: 600`; só o SHA-256 é persistido |
| `POST students/:id/nfc-card/activate` | Recebe `{ token }`, após gravar e verificar o NDEF; exige o mesmo profissional que preparou e é idempotente |
| `DELETE students/:id/nfc-card` | Revoga cartão ativo e preparação pendente |
| `POST attendances/nfc` | Recebe `{ token, classroom_id, date, start_time }`; retorna `student`, `attendance` e `already_recorded` |

O NDEF é um registro de texto `preceptoria:nfc:v1:<token>`. Preparação não substitui cartão ativo; somente a ativação confirma a troca. O token não entra na auditoria nem nas consultas. Não registre corpos dessas requisições em logs ou ferramentas de monitoramento. Cartões NDEF comuns são copiáveis: o identificador não é prova criptográfica de posse do cartão original.

A frequência NFC usa a mesma data não futura e horário inicial obrigatório da chamada manual. Salva presença ou corrige falta; preserva comparecimento/atraso previamente registrado e o horário já salvo da chamada. A transação bloqueia o aluno para serializar leituras NFC simultâneas e trocas/revogações. As alterações são auditadas com o usuário autenticado; a origem NFC aparece na auditoria de frequência. A API não aceita como prova o UID físico do cartão e não altera os outros estudantes da chamada.

## Importação de fichas de estudantes (SGGE / Sicap)

Disponível no dashboard em **Importações**, para administradores. Execute `node ace migration:run` após atualizar a API. A extração usa `pdfjs-dist` e `@napi-rs/canvas`, instalados pelo `npm ci`, sem Python ou serviço externo.

```bash
curl -X POST http://localhost:3333/api/v1/imports/students \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@FICHA DO ESTUDANTE_9º ANO A.pdf'
```

- Multipart no campo `file`: PDF de **até 20 MB e 300 páginas**, com texto selecionável, no modelo de ficha SGGE/Sicap. PDFs protegidos, digitalizados sem OCR, incompletos ou com matrículas repetidas são rejeitados antes da gravação.
- A turma vem do sufixo do arquivo (`_9º ANO A`, `_9° ANO A`); o **ano letivo vem do conteúdo do PDF**. O sistema reutiliza turmas equivalentes, como `9° A`, no mesmo ano, ou cria a turma. Turmas inativas ou ambíguas são sinalizadas.
- Cada ficha começa por matrícula e identificação, não por um número fixo de páginas. A posição do texto separa campos e colunas, preservando campos vazios e marcações de checkbox.
- Nome, matrícula e nascimento alimentam o cadastro do estudante. Mãe, pai e responsáveis são vinculados sem repetir pessoas reconhecidas dentro da mesma ficha.
- Identificação, filiação, responsáveis, dados pessoais, educação especial, endereço, documentação, Bolsa Família, contato, informações escolares, uniforme, alimentação/alergias e transporte são persistidos como **ficha estruturada**, com valores originais, avisos, páginas e texto de origem. Os snapshots ficam em `student_import_entries`; o histórico de arquivos e resultados fica em `student_imports`.
- Datas sentinela/impossíveis, UF/CEP incorretos, documentos com zeros e contatos inválidos ficam sem valor normalizado e mantêm o original para conferência. Inconsistências do próprio formulário (por exemplo, rótulo “CPF” para peça do uniforme) são identificadas pelo contexto da seção.
- A imagem é extraída da área de identificação, ignorando brasões e QR codes, convertida em JPEG com até 640 px no maior lado e salva no armazenamento privado já usado pelo app. Objetos de imagem acima de 4 megapixels não são decodificados, para limitar o consumo de memória; fotos não extraíveis geram aviso na ficha. Ficha sem foto permanece sem foto; foto já cadastrada é preservada.
- Matrícula existente com outro nome ou turma gera **conflito**, sem sobrescrever ou reenturmar. Nos cadastros compatíveis, dados básicos/contatos já preenchidos e anotações manuais são preservados. Campos básicos ausentes podem ser completados; novos snapshots guardam a ficha enviada.
- SHA-256 torna o reenvio do mesmo PDF idempotente: a resposta retorna `already_imported: true` e o resultado original. Um arquivo já importado não pode ser renomeado para enturmar os mesmos dados em outra turma.
- A gravação usa transação; fotos recém-gravadas são removidas em caso de rollback. O serviço aceita uma importação por processo de cada vez. O processamento tem limite de 90 segundos para leitura e o dashboard aguarda até 150 segundos pela resposta.

`GET imports/students` lista os últimos 20 arquivos; `GET imports/students/:id` recupera o resultado. `GET students/:id/imported-profile` retorna o último snapshot ou `profile: null`. Essas rotas exigem administração. A ficha completa não é incluída nas listagens gerais; a foto continua exigindo autenticação e as permissões de foto configuradas na API. Os PDFs recebidos são temporários: os dados/texto de origem e as fotos são preservados, mas o binário original não fica armazenado.

O proxy de produção deve aceitar o multipart de 20 MB e permitir o tempo de processamento (recomendação: timeout de 180 segundos). Os backups devem incluir as tabelas de importação e o diretório privado de fotos.

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
| DP07 | Importação de registros anteriores | Fichas cadastrais SGGE/Sicap podem ser importadas pelo dashboard. Importação de ocorrências antigas continua pendente; o modelo suporta `source = 'legacy'` |
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
- Importação de ocorrências antigas (DP07), OCR para PDFs digitalizados e envio de notificações aos responsáveis (DP03).
