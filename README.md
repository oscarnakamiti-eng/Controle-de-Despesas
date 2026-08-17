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

## Modelos (`netlify/functions/templates/`)

Gerados a partir dos seus arquivos originais, apenas com os campos variáveis em branco:

| Arquivo | Aba | Rateio | Lançamentos |
|---|---|---|---|
| `tpl_solicitacao_adiantamento.xlsx` | ADIANTAMENTO | 10 linhas | 9 (previstas: histórico + valor) |
| `tpl_prestacao_contas.xlsx` | PRESTAÇÃO CONTAS ADIANTAMENTO | 6 linhas | 22 |
| `tpl_reembolso.xlsx` | FORM 189 | 6 linhas | 22 |

> O formulário de reembolso original tinha 4 linhas de despesa; foi ampliado para 22
> replicando a formatação das linhas existentes e ajustando o `SUB TOTAL`. Todas as
> fórmulas foram recalculadas e validadas sem erros.

## Deploy pelo navegador

1. **GitHub** → New repository (vazio) → na página do repo, clique em
   "uploading an existing file" e arraste esta pasta inteira → Commit changes.
2. **Netlify** → Add new site → Import an existing project → Deploy with GitHub →
   selecione o repositório. O `netlify.toml` já define tudo (publish `public`,
   functions `netlify/functions`, e inclui os modelos `.xlsx` no bundle).
3. **Site settings → Environment variables** → adicione `ANTHROPIC_API_KEY`
   (chave criada em console.anthropic.com → API Keys, com billing ativo).
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

- Sem autenticação, os dados são compartilhados por quem acessar o site. Para restringir,
  use **Site settings → Visitor access** (senha) ou Netlify Identity.
- Almoço e jantar acima de R$ 35,00 aparecem sinalizados na tabela.
- O modelo usado na leitura é `claude-sonnet-5` (ajustável em `extract.mjs`).
