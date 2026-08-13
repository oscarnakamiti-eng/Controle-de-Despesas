# Controle de Despesas de Campo — versão Netlify

Front-end estático (React + Babel via CDN, sem etapa de build) + duas Netlify Functions:

- `netlify/functions/records.mjs` — lê/grava a lista de lançamentos no **Netlify Blobs**
  (store `expense-tracker`, chave `records`).
- `netlify/functions/extract.mjs` — recebe a imagem/PDF do recibo e chama a API da
  Anthropic **do lado do servidor**, usando a variável de ambiente `ANTHROPIC_API_KEY`
  (a chave nunca fica exposta no navegador).

## Estrutura

```
netlify.toml
package.json
public/
  index.html
  app.jsx
netlify/
  functions/
    records.mjs
    extract.mjs
```

## 1. Configurar a chave da API

No painel da Netlify: **Site settings → Environment variables → Add a variable**

- Key: `ANTHROPIC_API_KEY`
- Value: sua chave gerada em https://console.anthropic.com/settings/keys

Sem essa variável, a leitura de recibos retorna erro (a tabela manual continua funcionando).

## 2. Netlify Blobs

Não precisa de nenhuma configuração extra: sites publicados na Netlify já têm o Netlify
Blobs disponível automaticamente para as Functions (via contexto injetado). Não é preciso
criar token nem `siteID` manualmente.

> Observação: a store `expense-tracker` é única para o site — todas as pessoas que
> acessarem o site compartilham a mesma lista de lançamentos. Se isso não for desejado,
> proteja o site com uma senha em **Site settings → Visitor access**, ou peça para eu
> adicionar autenticação (Netlify Identity) e separar os dados por usuário.

## 3. Subir para o GitHub

Dentro da pasta do projeto (já contém `.gitignore`):

```bash
cd controle-despesas-campo
git init
git add .
git commit -m "Controle de despesas de campo"
```

Crie um repositório vazio no GitHub (sem README/licença, para não gerar conflito):
**github.com → New repository** — por exemplo `controle-despesas-campo`.

Depois conecte e envie:
```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/controle-despesas-campo.git
git push -u origin main
```
(Ou use `gh repo create controle-despesas-campo --private --source=. --push` se tiver o GitHub CLI.)

## 4. Conectar o repositório à Netlify

No painel da Netlify: **Add new site → Import an existing project → Deploy with GitHub**,
autorize o acesso e selecione o repositório. A Netlify detecta o `netlify.toml`
automaticamente:

- Build command: (vazio — não precisa)
- Publish directory: `public`
- Functions directory: `netlify/functions`

Ela roda `npm install` sozinha antes de empacotar as Functions (para instalar
`@netlify/blobs`). A partir daí, todo `git push` para `main` faz um novo deploy
automático — não precisa mais usar a CLI nem reenviar arquivos manualmente.

Não esqueça do passo 1 (`ANTHROPIC_API_KEY` em Site settings → Environment variables) —
ela é por site, então precisa ser configurada de novo se você recriar o site.

## 5. Testar localmente

```bash
npm install
netlify dev
```
O `netlify dev` sobe o site estático e as Functions juntos (com Blobs funcionando
localmente também), normalmente em `http://localhost:8888`.

## Sobre o modelo usado

A function `extract.mjs` chama o modelo `claude-sonnet-5`. Se quiser usar outro modelo
com visão (ex.: `claude-opus-4-8`), troque o valor de `model` nesse arquivo.
