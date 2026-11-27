# Preceptoria — Acompanhamento Escolar

Aplicativo (Expo / React Native) e API (AdonisJS) para a **Preceptoria** da Secretaria de Educação de
Itapissuma-PE, baseados no documento *"Preceptoria - Acompanhamento escolar"*.

| Pasta | O que é |
|---|---|
| `src/` | App mobile/web (Expo Router, SDK 58) |
| [`api/`](api/README.md) | API REST (AdonisJS 6): regras de negócio, auditoria, relatórios em PDF |
| [`dashboard/`](dashboard/README.md) | Dashboard web React, Tailwind CSS e shadcn/ui, integrado à mesma API |

## Rodando

**1. API**

```bash
cd api
npm install
cp .env.example .env && node ace generate:key
node ace migration:run && node ace db:seed
npm run dev                       # http://0.0.0.0:3333
```

**2. App**

```bash
npm install
npx expo start                    # a = Android, w = web
```

Por padrão, o app usa a API de produção em `https://preceptoria.bibliafoco.com.br`.
Para desenvolvimento local, defina `EXPO_PUBLIC_API_URL=http://IP-DO-COMPUTADOR:3333`;
nesse caso, **celular e computador precisam estar na mesma rede Wi-Fi**.

### Endereços publicados

- Dashboard administrativo: https://preceptoria.bibliafoco.com.br/dashboard/
- APK Android com NFC: https://preceptoria.bibliafoco.com.br/downloads/preceptoria-nfc.apk
- API: https://preceptoria.bibliafoco.com.br/api/v1

O perfil `apk` em `eas.json` gera APK de distribuição interna com a API de produção.
Para gerar outro, configure `credentials.json` localmente com a chave de assinatura original
(arquivo ignorado pelo Git) e execute `npx eas-cli@latest build --platform android --profile apk`.

> Em *development build* / produção no Android, requisições `http://` são bloqueadas por padrão: use
> `https` na API publicada. No Expo Go, `http` na rede local funciona.

### Acessos de demonstração (somente desenvolvimento)

Senha `Preceptoria@2026` para todos:

| Perfil | E-mail |
|---|---|
| Preceptor(a) | `preceptor@preceptoria.local` |
| Coordenação | `coordenacao@preceptoria.local` |
| Administração | `admin@preceptoria.local` |

## O que o app faz (por perfil)

Fluxo diário do PDF: **entrar → turma e data → frequência e fardamento → aulas → RAs**.

| Tela | Requisitos | Preceptor | Coordenação | Admin |
|---|---|---|---|---|
| Login | RF-01 | ✔ | ✔ | ✔ |
| Início (resumo do dia, conferências pendentes) | RF-10 | ✔ | ✔ | ✔ |
| Rotina → Frequência | RF-05 | lança | consulta | lança |
| Rotina → Fardamento e calçado | RF-02 | lança | consulta | lança |
| Rotina → Aulas, com "Não identificado" | RF-06, RF-07 | lança | consulta | lança |
| RAs (lista, filtros, novo, detalhe, cancelar) | RF-08, RF-12 | lança | consulta | lança |
| Detalhe do RA → histórico de alterações | CA06 | — | ✔ | ✔ |
| Enturmação e ficha (foto, responsáveis, histórico) | RF-04, RF-09 | ✔ | ✔ | ✔ |
| Ranking semanal/quinzenal | RF-03 | ✔ | ✔ | ✔ |

Cadastro de usuários, turmas, estudantes e a tabela de códigos RA é feito pela API (administração).
Ainda **não** há telas no app para: encaminhamentos (RF-11), exportar PDF, gráficos e administração.

## Preceptoria no ChatGPT

O MCP usa a mesma base do app e do dashboard. Permite consultar e corrigir frequência e fardamento,
registrar RAs e observações, e consultar a ficha de acompanhamento por período. Veja o
[guia de ativação e uso com relatórios](api/README.md#preceptoria-no-chatgpt-mcp).

## Cartão NFC e presença por aproximação

- Na **ficha do estudante**, preceptores vinculados à turma e administradores podem **Cadastrar cartão NFC**, gravar um substituto ou desvincular o cartão. Coordenação continua somente com consulta aos registros.
- Use cartões **NTAG213/215/216 regraváveis com NDEF** e celular Android ou iPhone com NFC. A gravação substitui o conteúdo do cartão; o app relê o conteúdo antes de ativar o vínculo na API.
- O cartão contém apenas um identificador aleatório de 256 bits, sem nome, matrícula ou outros dados pessoais. O banco guarda seu SHA-256. Preparar uma troca não invalida o cartão antigo: isso só acontece ao confirmar a gravação. Uma preparação expira em 10 minutos.
- Em **Rotina → Frequência**, selecione turma, data e hora de início. Use a marcação manual ou **Ler cartão NFC**. A leitura salva imediatamente **Presente** para aquele aluno; pode corrigir uma falta já salva, mas não substitui presença ou atraso existentes. Releituras não duplicam o registro. Alterações manuais de outros alunos que ainda não foram salvas são preservadas na tela e continuam dependendo de **Salvar frequência**.
- As mesmas permissões de turma, atividade do aluno e auditoria se aplicam. O cadastro, a ativação e a frequência dependem de conexão com a API. Um cartão perdido pode ser desvinculado ou substituído; os registros de presença anteriores permanecem.
- O identificador é estático e cartões NDEF comuns podem ser copiados. Esse fluxo identifica o cartão apresentado ao profissional; não é um mecanismo antifraude ou de autenticação do estudante.

### Instalação e teste NFC

Requer **Node.js 22.13+** (recomendado: 24 LTS), API atualizada com `cd api && node ace migration:run` e **novo build nativo** do app com `react-native-nfc-manager` (já configurado em `app.json`). NFC não funciona no Expo Go, no navegador ou em emuladores. Para produção, gere e distribua novos builds Android/iOS pelo EAS; uma atualização apenas JavaScript não instala o módulo nativo. No iOS, habilite NFC no App ID e no provisionamento.

Antes de distribuir, valide em **aparelhos físicos Android e iPhone**: gravar cartão vazio, ler e registrar presença, reler sem duplicar, preservar atraso manual, trocar e revogar cartão, cancelar leitura, cartão somente leitura, NFC desligado e falha de rede durante a confirmação. Se a gravação foi verificada mas a confirmação falhou, use **Confirmar vínculo do cartão** antes de tentar gravar novamente.

## Identidade visual

Paleta extraída da logo da Secretaria (`assets/images/logo.jpeg`): azul-marinho `#141B47`, azul-céu
`#549CCC`, verde `#2F9A55`, marrom `#6C4A3C`. Definida em `src/constants/theme.ts` (tema claro e escuro) e
espelhada na API para os PDFs. RAs positivos são sempre verdes e os negativos, vermelhos.

## Verificações

```bash
npx tsc --noEmit                  # app
cd api && npm test                # 71 testes da API
```
