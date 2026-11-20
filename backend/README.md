# Feedback da Study Pomodoro

O site envia pedidos JSON para o caminho `/feedback` do Worker. O Worker aceita a origem do site, valida os campos e guarda a mensagem no D1. Uma repetição com o mesmo identificador e conteúdo devolve o mesmo recibo. O limite por endereço de rede é de seis tentativas por minuto em cada localização Cloudflare. A base de dados contém a data UTC, categoria, idioma, mensagem, contacto opcional e identificador do recibo.

## Consultar as mensagens

No painel Cloudflare, abre D1, seleciona `studypomodoro-feedback` e consulta a tabela `feedback`. Para começar pelas mais recentes, usa a consola SQL privada.

```sql
SELECT created_at, category, language, message, email
FROM feedback
ORDER BY created_at DESC
LIMIT 100;
```

## Publicar o serviço

Os comandos seguintes usam Wrangler 4 na pasta `backend`. Na primeira instalação, autentica-te na conta Workers Free com `wrangler login`, cria a base com `wrangler d1 create studypomodoro-feedback --location weur` e indica o UUID devolvido em `database_id` na entrada `DB` de `wrangler.json`.

```sh
wrangler d1 migrations apply DB --remote
wrangler deploy
```

Coloca o URL HTTPS publicado seguido de `/feedback` no atributo `data-endpoint` dos formulários inglês e português. Antes de encaminhar a app, envia uma mensagem de teste através do site e confirma a mesma mensagem e o mesmo idioma na consola D1. O endpoint concede acesso de escrita através do formulário. A leitura exige acesso à conta Cloudflare.

Para testar localmente, usa `wrangler d1 migrations apply DB --local` e `wrangler dev --var SITE_ORIGIN:http://127.0.0.1:8000`. Aponta o formulário local para o URL de desenvolvimento seguido de `/feedback`.
