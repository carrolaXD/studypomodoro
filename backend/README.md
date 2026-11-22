# Feedback da Study Pomodoro

O site envia pedidos JSON para `https://studypomodoro-feedback.pedrocarrola2006.workers.dev/feedback`. O Worker aceita a origem do site, valida os campos e guarda a mensagem no D1. Uma repetição com o mesmo identificador e conteúdo devolve o mesmo recibo. O limite por endereço de rede é de seis tentativas por minuto em cada localização Cloudflare. A base de dados contém a data UTC, categoria, idioma, mensagem, contacto opcional e identificador do recibo.

## Consultar as mensagens

No painel Cloudflare, abre D1, seleciona `studypomodoro-feedback` e consulta a tabela `feedback`. Para começar pelas mensagens mais recentes, usa a consola SQL privada.

```sql
SELECT id, created_at, category, language, message, email
FROM feedback
ORDER BY created_at DESC
LIMIT 100;
```

## Publicar o serviço

Os comandos seguintes usam Wrangler 4 na pasta `backend`. Autentica-te com `wrangler login`. A configuração já aponta para a base de produção na região WEUR.

```sh
wrangler d1 migrations apply DB --remote
wrangler deploy
```

Após alterações ao serviço, envia uma mensagem de teste através do site e confirma a mesma mensagem e o mesmo idioma na consola D1. O endpoint concede acesso de escrita através do formulário. A leitura exige acesso à conta Cloudflare.

Para testar localmente, usa `wrangler d1 migrations apply DB --local` e `wrangler dev --var SITE_ORIGIN:http://127.0.0.1:8000`. Aponta o formulário local para o URL de desenvolvimento seguido de `/feedback`.

## Ativar as notificações por Gmail

A migração `0002` cria uma fila em D1 a partir das novas inserções. Cada submissão e a sua entrada na fila são gravadas na mesma operação. As mensagens anteriores à migração ficam apenas no histórico. O Worker guarda o feedback e devolve o recibo imediatamente. O agendamento consulta a fila de cinco em cinco minutos e só tenta enviar após a configuração abaixo.

1. Gera um segredo num terminal privado com `openssl rand -hex 32`. Usa o mesmo valor de 64 caracteres hexadecimais nos dois serviços. Guarda-o num gestor de passwords e evita colocá-lo em ficheiros, argumentos de comandos ou mensagens.
2. Na conta Google que vai receber o feedback, abre [Google Apps Script](https://script.google.com/home), cria um projeto independente chamado **Study Pomodoro Feedback** e copia o conteúdo de [Code.gs](apps-script/Code.gs). Em **Project Settings**, ativa **Show "appsscript.json" manifest file in editor** e substitui o manifesto por [appsscript.json](apps-script/appsscript.json).
3. Em **Project Settings > Script Properties**, adiciona `FEEDBACK_MAIL_SECRET` com o segredo e `FEEDBACK_RECIPIENT` com o endereço Gmail destinatário. Mantém o projeto privado.
4. No editor seleciona **authorizeMail > Run** e autoriza o envio de email na tua conta. Em **Deploy > New deployment**, escolhe **Web app**, **Execute as: Me** e **Who has access: Anyone**. O Worker precisa de aceder ao URL sem uma sessão Google. O código valida a assinatura HMAC antes de processar o feedback e só envia para o endereço fixado em **Script Properties**. Copia o URL publicado que termina em `/exec`. Consulta [Web apps](https://developers.google.com/apps-script/guides/web) e [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).
5. Em Cloudflare, publica o Worker seguindo a secção anterior se esta revisão ainda não estiver ativa. Depois, na pasta `backend`, define os valores com os comandos abaixo. Cola o segredo e o URL apenas quando o Wrangler os pedir. Em alternativa, usa **Workers & Pages > studypomodoro-feedback > Settings > Variables and Secrets** e seleciona o tipo **Secret** para ambas as entradas.

```sh
wrangler secret put FEEDBACK_MAIL_URL
wrangler secret put FEEDBACK_MAIL_SECRET
```

O email usa o assunto `[Study Pomodoro] New feedback: <category>` e inclui a categoria, data UTC, mensagem integral, contacto opcional e identificador. D1 é a fonte principal. O Apps Script processa o conteúdo para o enviar ao Gmail e conserva apenas o estado, ID e data das tentativas para deduplicação. Nenhuma resposta pública devolve o conteúdo do feedback.

## Validar após a ativação

A simulação local da fila, assinaturas e MailApp corre com Node.js 22 ou mais recente através de `node --test tests/notifications.test.mjs`, na pasta `backend`.

1. Envia uma mensagem sintética pela homepage, com categoria **Bug** e um texto único. Confirma o recibo na página e a linha com o mesmo texto na tabela `feedback`. Usa apenas dados de teste.
2. Em DevTools, no separador **Network**, abre o POST de teste a `/feedback` e usa **Replay XHR** quando disponível, ou **Copy as cURL** num terminal privado. Repete o POST com o mesmo UUID e conteúdo. Espera o mesmo recibo, uma linha em `feedback` e uma em `feedback_notifications`. A repetição não deve criar um segundo email.
3. Confirma no Gmail uma mensagem com o assunto esperado e o mesmo ID, categoria, data e texto após o próximo ciclo. A propagação inicial do Cron Trigger pode demorar até 15 minutos. [Cron Triggers da Cloudflare](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
4. Para validar uma falha recuperável, adiciona temporariamente `FEEDBACK_PAUSED=true` às **Script Properties** e envia outro teste sintético. Aguarda que a fila mostre `pending` com `last_error='paused'` e confirma que a mensagem ficou guardada em `feedback`. Retira a propriedade. Após a próxima tentativa elegível, confirma `sent` e um único email. Durante a pausa, outros envios continuam a entrar em D1 e ficam à espera na fila.

## Manutenção da fila

Usa a consola SQL privada do D1 para consultar o estado sem mostrar o conteúdo das mensagens.

```sql
SELECT id, status, attempts, last_error,
       datetime(next_attempt_at, 'unixepoch') AS next_attempt_utc,
       datetime(sent_at, 'unixepoch') AS sent_utc
FROM feedback_notifications
ORDER BY next_attempt_at DESC
LIMIT 100;
```

- **pending.** Até três envios por ciclo. A fila repete falhas temporárias após 5, 10, 20 minutos e assim sucessivamente até oito tentativas ou sete dias desde a primeira tentativa. Se a quota do MailApp se esgotar, essa notificação espera 24 horas. `sent` significa que o MailApp aceitou o envio.
- **failed.** A tentativa automática esgotou o limite. Corrige a configuração ou verifica a disponibilidade do Google e pesquisa o ID no Gmail antes de voltar a pôr a notificação na fila. O conteúdo continua em `feedback`.
- **review.** O Apps Script chegou ao passo de envio, mas ficou sem confirmação inequívoca. O MailApp pode já ter aceite o email. Pesquisa o ID no Gmail antes de tomar uma decisão. Se a mensagem estiver no Gmail, marca a fila como `sent` pela consola D1. Caso contrário, após verificares também as execuções do Apps Script, define `FEEDBACK_RESET_ID` com esse ID nas **Script Properties**, corre **resetReviewedDelivery** no editor e só depois executa o SQL abaixo. Para `failed` com estado incerto no Google, aplica a mesma verificação. O comando do editor preserva registos que já foram confirmados como enviados.

```sql
UPDATE feedback_notifications
SET status = 'pending', attempts = 0, first_attempt_at = NULL,
    next_attempt_at = unixepoch(), claim_token = NULL, last_error = NULL
WHERE id = 'UUID-DO-RECIBO' AND status IN ('failed', 'review');
```

Para assinalar uma entrega já confirmada no Gmail, usa o ID e a data de receção em UTC.

```sql
UPDATE feedback_notifications
SET status = 'sent', sent_at = unixepoch('DATA-UTC-DO-EMAIL'),
    claim_token = NULL, last_error = NULL
WHERE id = 'UUID-DO-RECIBO' AND status IN ('failed', 'review');
```

O Worker assina cada pedido com HMAC-SHA-256 e carimbo temporal. O Apps Script valida a assinatura, rejeita pedidos com mais de cinco minutos de desvio, e serializa envios com um bloqueio. Os marcadores ficam 14 dias, acima da janela automática de sete dias. O projeto usa as quotas gratuitas do Apps Script, que publica o limite de 100 destinatários por dia para contas pessoais. [Quotas do Apps Script](https://developers.google.com/apps-script/guides/services/quotas)

Para rodar o segredo, pausa primeiro os envios nas **Script Properties**, atualiza `FEEDBACK_MAIL_SECRET` nos dois serviços e remove a pausa. Para atualizar código do Apps Script, cria uma nova versão em **Deploy > Manage deployments > Edit** para manter o mesmo URL. Não publiques os valores dos segredos nem os conteúdos de feedback em logs, issues ou commits.
