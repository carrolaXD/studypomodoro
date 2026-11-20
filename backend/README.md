# Feedback da Study Pomodoro

O site envia pedidos JSON para `https://studypomodoro-feedback.pedrocarrola2006.workers.dev/feedback`. O Worker aceita a origem do site, valida os campos e guarda a mensagem no D1. Uma repetição com o mesmo identificador e conteúdo devolve o mesmo recibo. O limite por endereço de rede é de seis tentativas por minuto em cada localização Cloudflare. A base de dados contém a data UTC, categoria, idioma, mensagem, contacto opcional e identificador do recibo.

## Consultar as mensagens

No painel Cloudflare, abre D1, seleciona `studypomodoro-feedback` e consulta a tabela `feedback`. As notificações por email estão desativadas. Para começar pelas mensagens mais recentes, usa a consola SQL privada.

```sql
SELECT created_at, category, language, message, email
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
