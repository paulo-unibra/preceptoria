import type { HttpContext } from '@adonisjs/core/http'
import { APP_NAME, BRAND, ORG_NAME } from '#support/brand'

const CONTACT_EMAIL = 'pr838908@gmail.com'
const UPDATED_AT = '28/10/2026'

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade - Preceptoria</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${BRAND.navyDark};line-height:1.6;margin:0;background:${BRAND.offWhite}}
  header{background:${BRAND.navy};color:#fff;padding:28px 20px}
  header h1{margin:0;font-size:1.5rem} header p{margin:6px 0 0;color:${BRAND.skyLight}}
  main{max-width:820px;margin:0 auto;padding:24px 20px 48px}
  h2{color:${BRAND.navy};margin-top:2rem;border-bottom:2px solid ${BRAND.sky};padding-bottom:4px;font-size:1.15rem}
  ul{padding-left:1.2rem} li{margin:.25rem 0}
  .note{background:#fff;border:1px solid ${BRAND.border};border-radius:10px;padding:12px 16px}
  a{color:${BRAND.blue}}
</style>
</head>
<body>
<header>
  <h1>Política de Privacidade</h1>
  <p>${APP_NAME} · Última atualização: ${UPDATED_AT}</p>
</header>
<main>
<p>Esta política explica como o aplicativo <strong>Preceptoria</strong> (“o aplicativo”) trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).</p>

<h2>1. A quem se destina</h2>
<p>O aplicativo é uma ferramenta de trabalho de profissionais da educação (preceptores, coordenação e administração) da rede atendida por <strong>${ORG_NAME}</strong>. <strong>Não é destinado ao uso por crianças.</strong> Os dados de estudantes são inseridos e consultados apenas por profissionais autorizados. O acesso exige conta criada pela administração; não há cadastro aberto ao público.</p>

<h2>2. Dados tratados</h2>
<p><strong>Profissionais (usuários):</strong></p>
<ul>
  <li>nome, e-mail, perfil de acesso e turmas vinculadas;</li>
  <li>senha (armazenada apenas de forma criptografada, com hash) e registros de acesso;</li>
  <li>registro de auditoria das alterações feitas (quem alterou, o quê e quando).</li>
</ul>
<p><strong>Estudantes:</strong></p>
<ul>
  <li>nome, matrícula, data de nascimento, turma e observações de acompanhamento;</li>
  <li>foto (opcional);</li>
  <li>registros escolares: frequência, horário de chegada, justificativas de falta, fardamento e calçado, aulas, registros acadêmicos (RA), notificações, encaminhamentos e observações.</li>
</ul>
<p><strong>Responsáveis:</strong> nome, grau de parentesco e telefone.</p>
<p>O aplicativo <strong>não</strong> coleta localização, contatos do aparelho, microfone, câmera, identificadores de publicidade nem dados de uso para análise.</p>

<h2>3. Finalidade</h2>
<p>Apoiar o acompanhamento pedagógico e a rotina escolar: registrar frequência, atrasos, fardamento, aulas e ocorrências; gerar relatórios (inclusive em PDF); e organizar notificações e encaminhamentos. Os dados não são usados para publicidade, perfilamento comercial nem venda.</p>

<h2>4. Base legal</h2>
<p>O tratamento ocorre para o cumprimento de atribuições legais e execução de políticas públicas educacionais (LGPD, arts. 7º, III e 23) e observa o melhor interesse da criança e do adolescente (art. 14).</p>

<h2>5. Compartilhamento</h2>
<p>Os dados não são vendidos nem compartilhados com terceiros para fins comerciais. Ficam hospedados em servidor próprio contratado para este serviço, que atua apenas como infraestrutura de hospedagem. O aplicativo não utiliza serviços de anúncios, análise de uso ou monitoramento de terceiros.</p>

<h2>6. Segurança</h2>
<ul>
  <li>comunicação criptografada (HTTPS/TLS);</li>
  <li>autenticação por conta individual e controle de acesso por perfil e por turma;</li>
  <li>telefone dos responsáveis e fotos de estudantes visíveis apenas aos perfis autorizados;</li>
  <li>cópias de segurança periódicas do banco de dados e registro de auditoria.</li>
</ul>

<h2>7. Retenção e exclusão</h2>
<p>Os dados são mantidos enquanto forem necessários ao acompanhamento escolar e às obrigações legais. A correção ou exclusão de dados pode ser solicitada conforme a seção 8.</p>

<h2>8. Direitos do titular</h2>
<p>Nos termos do art. 18 da LGPD, o titular (ou o responsável legal, no caso de crianças e adolescentes) pode solicitar: confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados, portabilidade e informações sobre compartilhamento. As solicitações devem ser feitas à ${ORG_NAME} ou pelo contato abaixo.</p>

<h2>9. Alterações desta política</h2>
<p>Esta política pode ser atualizada. A data da última revisão consta no topo desta página.</p>

<h2>10. Contato</h2>
<p class="note">Dúvidas, solicitações ou reclamações sobre privacidade: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</main>
</body>
</html>`

export default class PagesController {
  /** Política de privacidade pública (exigida pela Google Play). */
  async privacy({ response }: HttpContext) {
    return response.header('Content-Type', 'text/html; charset=utf-8').send(html)
  }
}
