# Preceptoria — Acompanhamento Escolar

Aplicativo (Expo / React Native) e API (AdonisJS) para a **Preceptoria** da Secretaria de Educação de
Itapissuma-PE, baseados no documento *"Preceptoria - Acompanhamento escolar"*.

| Pasta | O que é |
|---|---|
| `src/` | App mobile/web (Expo Router, SDK 58) |
| [`api/`](api/README.md) | API REST (AdonisJS 6): regras de negócio, auditoria, relatórios em PDF |

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

O app descobre sozinho o endereço da API: usa o mesmo computador que serve o Expo (porta 3333), então
**celular e computador precisam estar na mesma rede Wi-Fi**. Para apontar para outro servidor, defina
`EXPO_PUBLIC_API_URL` (ex.: `EXPO_PUBLIC_API_URL=https://api.escola.gov.br npx expo start`).

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

## Identidade visual

Paleta extraída da logo da Secretaria (`assets/images/logo.jpeg`): azul-marinho `#141B47`, azul-céu
`#549CCC`, verde `#2F9A55`, marrom `#6C4A3C`. Definida em `src/constants/theme.ts` (tema claro e escuro) e
espelhada na API para os PDFs. RAs positivos são sempre verdes e os negativos, vermelhos.

## Verificações

```bash
npx tsc --noEmit                  # app
cd api && npm test                # 71 testes da API
```
