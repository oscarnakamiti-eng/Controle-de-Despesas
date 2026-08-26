# Despesas de Viagem — FORM 189 (Netlify)

Aplicativo que lê recibos, notas fiscais e cupons fiscais em lote, monta a tabela de
despesas e gera automaticamente os formulários oficiais em Excel + o relatório
fotográfico em PDF.

## Os dois fluxos

**Com adiantamento**
1. Preenche as despesas previstas → baixa a **Solicitação de Adiantamento** (antes da viagem)
2. Envia os comprovantes → baixa a **Prestação de Contas** + **relatório em PDF**

**Sem adiantamento**
- Envia os comprovantes → baixa a **Solicitação de Reembolso** + **relatório em PDF**

## O que fica armazenado (Netlify Blobs)

Store `expense-tracker`:

| Chave | Conteúdo |
|---|---|
| `despesas.xlsx` | Tabela de lançamentos, como planilha Excel de verdade |
| `file:<id>` / `file-meta:<id>` | Arquivo original de cada comprovante (imagem/PDF) |
| `profile` | Dados fixos do solicitante (nome, cargo, CPF, banco, agência, conta, PIX) |
| `rateio-presets` | Usinas, centros de custo, projetos, fase e percentuais recorrentes |

Como os arquivos ficam no servidor, a pré-visualização e o relatório fotográfico
continuam funcionando depois de fechar ou recarregar a página.

## Funções (`netlify/functions/`)

- `extract.mjs` — chama a API da Anthropic (server-side, chave em `ANTHROPIC_API_KEY`)
  para ler o comprovante e arquiva o original nos Blobs.
- `records.mjs` — lê/grava a tabela de despesas como `.xlsx`.
- `files.mjs` — serve (`GET`) e apaga (`DELETE`) os arquivos dos comprovantes.
- `profile.mjs` — dados fixos do solicitante.
- `rateio.mjs` — presets de rateio.
- `generate-report.mjs` — preenche os modelos oficiais em `templates/` preservando
  integralmente layout, fórmulas, bordas e a logomarca do formulário.
- `generate-photo-report.mjs` — monta o relatório fotográfico em PDF a partir dos
  comprovantes já guardados. Se `CLOUDCONVERT_API_KEY` estiver configurada, converte
  a planilha gerada em PDF (via [CloudConvert](https://cloudconvert.com)) e a
  inclui como primeira página; sem a chave, ou se a conversão falhar, o relatório
  sai normalmente só com as fotos.

## Modelos (`netlify/functions/templates/`)

Gerados a partir dos seus arquivos originais, apenas com os campos variáveis em branco.
Cada formulário existe em vários tamanhos e a função escolhe **automaticamente o menor
modelo que comporte a quantidade de lançamentos**:

| Formulário | Aba | Rateio | Tamanhos disponíveis |
|---|---|---|---|
| Solicitação de Adiantamento | ADIANTAMENTO | 10 linhas | 9, 20, 40, 60 |
| Prestação de Contas | PRESTAÇÃO CONTAS ADIANTAMENTO | 6 linhas | 22, 30, 40, 60, 90 |
| Solicitação de Reembolso | FORM 189 | 6 linhas | 10, 22, 30, 40, 60, 90 |

As linhas extras são geradas replicando a formatação das linhas originais (bordas,
mesclagens, altura) e as fórmulas de SUB TOTAL, TOTAL GERAL e SALDO FINAL são
reapontadas para o novo intervalo. Todos os modelos foram validados: sem mesclagens
sobrepostas, com a logomarca preservada e fórmulas recalculando sem erro.

## Deploy pelo navegador

1. **GitHub** → New repository (vazio) → na página do repo, clique em
   "uploading an existing file" e arraste esta pasta inteira → Commit changes.
2. **Netlify** → Add new site → Import an existing project → Deploy with GitHub →
   selecione o repositório. O `netlify.toml` já define tudo (publish `public`,
   functions `netlify/functions`, e inclui os modelos `.xlsx` no bundle).
3. **Site settings → Environment variables** → adicione `ANTHROPIC_API_KEY`
   (chave criada em console.anthropic.com → API Keys, com billing ativo).
   Opcionalmente, adicione `CLOUDCONVERT_API_KEY` (conta gratuita em
   cloudconvert.com → API Keys) para incluir a planilha como primeira página
   do relatório fotográfico.
4. **Deploys → Trigger deploy** para aplicar a variável.

Depois disso, cada commit na `main` gera um novo deploy automático.

## Primeiro uso

1. Aba **Cadastros** → preencha os dados do solicitante e os presets de rateio → Salvar.
   (Feito uma vez; entra sozinho em todos os formulários daí em diante.)
2. Aba **Despesas** → arraste os comprovantes em lote → confira as linhas marcadas com ⚠.
3. Aba **Gerar formulários** → escolha o fluxo → baixe a planilha e o relatório.

## Testar localmente

```bash
npm install
netlify dev
```

## Observações

- O acesso é por nome de usuário (login.mjs, sem senha) — cada pessoa é
  cadastrada pelo administrador via `admin.mjs` (protegido por `ADMIN_TOKEN`).
  O site inteiro chegou a ficar atrás de uma senha compartilhada via
  `netlify/edge-functions/gate.js`, mas isso foi desativado: quebrava a
  chamada de login em alguns navegadores/webviews de celular (a credencial
  do Basic Auth não era reenviada na chamada em segundo plano). O arquivo
  continua no repositório, desligado, com a justificativa em comentário.
- Almoço e jantar acima de R$ 35,00 aparecem sinalizados na tabela.
- O modelo usado na leitura é `claude-sonnet-5` (ajustável em `extract.mjs`).

## Diagnóstico da chave da API

Se a leitura de comprovantes retornar erro 401 (`invalid x-api-key`), abra no navegador:

```
https://SEU-SITE.netlify.app/.netlify/functions/diag
```

A função devolve um JSON dizendo se a variável chegou à função, se tem espaços/aspas,
se o prefixo está certo, e faz um teste real contra a API — sem nunca exibir a chave.
O campo `diagnostico` indica o que corrigir.

## Comprovantes em PDF

PDFs são convertidos em imagem no próprio navegador (pdf.js) no momento do envio,
página por página, e as imagens ficam guardadas nos Blobs (`preview:<id>:<n>`).
Isso faz com que:

- a pré-visualização mostre o conteúdo do PDF, não um ícone quebrado;
- o relatório fotográfico gere **uma página por página do PDF** e imprima corretamente.

Um PDF de 3 páginas vira 3 páginas do relatório. Se a conversão falhar por algum
motivo, o relatório mantém um link para abrir o arquivo original.
