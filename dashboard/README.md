# Preceptoria · Dashboard web

Aplicação web React independente do Expo, no mesmo repositório e consumindo a mesma API REST (`/api/v1`).

## Executar

Requer Node.js **20.19+** ou **22.12+** (recomendado: Node 24 LTS).

```bash
cd dashboard
npm ci
cp .env.example .env.local
npm run dev
```

Acesse **http://localhost:5173/dashboard/** e entre com a mesma conta do aplicativo.
Por padrão, o dashboard usa `https://preceptoria.bibliafoco.com.br`. Para usar o backend local, configure em `.env.local`:

```dotenv
VITE_API_URL=http://localhost:3333
VITE_BASE_PATH=/dashboard/
```

Inicie a API conforme [`../api/README.md`](../api/README.md). As contas de demonstração documentadas ali funcionam apenas no ambiente de desenvolvimento. Reinicie o Vite após alterar as variáveis.

## Funcionalidades

- Login, restauração de sessão, logout e tratamento de token expirado.
- Visão geral com estudantes ativos, frequência, RAs, encaminhamentos e indicadores por turma.
- Gráfico diário de presenças e faltas e distribuição de RAs positivos/negativos.
- Estudantes com busca, paginação, ficha, responsáveis permitidos pelo perfil e histórico individual.
- Ocorrências com busca por descrição, polaridade, datas, turma e detalhes.
- Destaques semanais, pontuação e pesos retornados pela API.
- Download autenticado de relatórios individuais e por turma em PDF.
- Área **Importações** para administradores: upload de fichas SGGE/Sicap, turma pelo nome do arquivo, criação de estudantes/responsáveis, extração de fotos, avisos por ficha e histórico de resultados.
- Foto autenticada na listagem e no detalhe do estudante; ficha cadastral completa importada disponível para administração.
- Sidebar responsiva, navegação por teclado, estados de carregamento, erro e ausência de dados.

Os filtros de turma e período ficam na URL e são mantidos na navegação. O período é limitado a 93 dias para limitar o volume de históricos carregados. A lista de estudantes mostra matrículas ativas; o período filtra seu histórico. O ranking usa a janela semanal configurada no servidor, encerrada na data final escolhida. Frequência considera presentes e atrasados sobre as chamadas registradas; ausência de chamada aparece como `—`, não como 0%.

## Stack e organização

**React 19 · TypeScript strict · Vite 8 · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide React · Recharts 3 · TanStack Query 5 · React Router 7.** As versões exatas estão fixadas no `package-lock.json`.

```text
src/
  components/       Layout, gráficos, feedbacks e componentes compartilhados
    ui/             Componentes shadcn/ui, mantidos no próprio projeto
  hooks/            Consultas de relatórios e debounce
  lib/              API, autenticação, filtros, contratos e cálculos analíticos
  pages/            Login, visão geral, estudantes, ocorrências, ranking e relatórios
  styles.css        Tokens visuais, Tailwind e superfícies glass
```

Os contratos são importados como **tipos** de `../src/lib/types.ts`, sem carregar código do Expo. O estado remoto fica no TanStack Query, com cache, cancelamento, atualização ao recuperar foco e retry limitado. Páginas e gráficos são carregados sob demanda. A fonte Inter é hospedada junto com a aplicação.

Os tokens ficam em `sessionStorage` (por aba), são enviados no header `Authorization` e removidos ao sair ou receber 401. Dados de consultas são descartados ao encerrar a sessão. As permissões e o escopo por turma são sempre aplicados pela API.

### Importar estudantes

1. Atualize a API e execute a migration de importação: `cd api` → `npm ci` → `node ace migration:run`.
2. Entre no dashboard com uma conta de administração e abra **Importações** (ou **Estudantes → Importar fichas em PDF**).
3. Selecione um PDF com nome como `FICHA DO ESTUDANTE_9º ANO A.pdf` e clique em **Importar estudantes**. Limites: 20 MB, 300 páginas, texto selecionável e modelo SGGE/Sicap.
4. Confira a turma/ano, os totais, as fotos e os avisos. O resultado permite abrir a ficha completa de cada estudante e pode ser recuperado em **Últimas importações**.

O processamento acontece no servidor, com a mesma autenticação da API. O ano vem do PDF e o destino da turma vem do nome do arquivo, independentemente dos filtros do dashboard. Reenviar o mesmo PDF recupera o resultado sem duplicações. Conflitos de matrícula/nome/turma são sinalizados, e dados manuais e fotos existentes são preservados. Fichas sem foto ficam com iniciais como fallback. PDFs digitalizados sem texto precisam passar por OCR antes do envio.

Os dados cadastrais extensos e sensíveis ficam na ficha importada de acesso administrativo. Valores normalizados e originais são mostrados juntos quando há diferença. Consulte [`../api/README.md`](../api/README.md#importação-de-fichas-de-estudantes-sgge--sicap) para os contratos e regras de persistência.

### Design

Glassmorphism quente inspirado nas referências visuais do projeto: ambiente arquitetônico ao fundo, painel flutuante em vidro fosco, paleta areia/champagne, bordas brancas semitransparentes e sombras difusas. As superfícies usam `backdrop-filter: blur(20px)` e o painel principal usa blur de 28px, com navegação lateral compacta e dock flutuante no desktop. Gráficos usam verde, coral e tons neutros. Microinterações respeitam `prefers-reduced-motion`; navegadores sem backdrop-filter recebem superfícies mais opacas.

A fotografia decorativa fica em `public/images/studio-interior.jpg`, com a fonte e a licença em `public/images/CREDITS.md`. É servida localmente, sem requisições externas durante o uso do dashboard. A imagem não representa as instalações da escola.

Adicionar componentes shadcn/ui:

```bash
npx shadcn@latest add nome-do-componente
```

## Verificação e produção

```bash
npm run lint
npm run typecheck
npm run build
npm run preview
```

O build é gerado em `dashboard/dist/`. Publique essa pasta sob `/dashboard/`, configurando fallback das rotas da SPA para `/dashboard/index.html`. Não redirecione as rotas `/api/v1` para o frontend.

Exemplo Nginx (considerando `dist/` copiado para `/var/www/preceptoria/dashboard/`):

```nginx
location = /dashboard {
    return 301 /dashboard/;
}
location /dashboard/ {
    root /var/www/preceptoria;
    try_files $uri $uri/ /dashboard/index.html;
}
```

Para publicar em uma origem separada na raiz, use `VITE_BASE_PATH=/` antes do build. `VITE_API_URL` também é incorporada no build e precisa apontar para uma origem acessível pelo navegador. Em hospedagem separada, a API precisa permitir a origem do dashboard via CORS. Variáveis `VITE_*` são públicas; nunca coloque segredos nelas.
