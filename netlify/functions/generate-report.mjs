// Netlify Function (v2) — preenche os formulários oficiais (FORM 189) preservando
// integralmente o layout original: fórmulas, bordas, formatos e a logomarca.
//
// Cada formulário tem modelos em vários tamanhos; o menor que couber é escolhido
// automaticamente conforme a quantidade de lançamentos.
//
// POST { tipo, profile, motivo, valorAdiantamento, rateio: [...], records: [...], previsoes: [...] }
//   tipo: "solicitacao-adiantamento" | "prestacao-contas" | "reembolso"

import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

// não declarar __dirname: o runtime da Netlify já o define e a redeclaração quebra a função
const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");
const LOGO_PATH = path.join(TEMPLATES_DIR, "logo.jpg");

// A logomarca não fica embutida nos modelos: o ExcelJS não consegue ler o desenho
// gravado pelo openpyxl (erro "reading 'anchors'"). Ela é reinserida aqui, na mesma
// posição e tamanho do formulário original.
function inserirLogo(wb, ws) {
  try {
    const imageId = wb.addImage({ filename: LOGO_PATH, extension: "jpeg" });
    ws.addImage(imageId, {
      tl: { col: 0.09, row: 1.09 },   // canto superior esquerdo (coluna A, linha 2)
      ext: { width: 199, height: 41 },
      editAs: "oneCell",
    });
  } catch {
    // sem a logo o formulário continua válido; não vale derrubar a geração por isso
  }
}

const FORMS = {
  "solicitacao-adiantamento": {
    sheet: "ADIANTAMENTO",
    fileName: "solicitacao-adiantamento.xlsx",
    motivoCell: "B16",
    rateio: { first: 21, max: 10, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "E", nProjeto: "G", fase: "H", percentual: "J" } },
    itemCols: { obs: "B", valor: "K" },   // despesas PREVISTAS: histórico + valor
    tiers: [
      { n: 9,  file: "tpl_solicitacao_adiantamento_9.xlsx",  first: 34 },
      { n: 20, file: "tpl_solicitacao_adiantamento_20.xlsx", first: 34 },
      { n: 40, file: "tpl_solicitacao_adiantamento_40.xlsx", first: 34 },
      { n: 60, file: "tpl_solicitacao_adiantamento_60.xlsx", first: 34 },
    ],
  },
  "prestacao-contas": {
    sheet: "PRESTAÇÃO CONTAS ADIANTAMENTO",
    fileName: "prestacao-contas-adiantamento.xlsx",
    motivoCell: "B16",
    rateio: { first: 21, max: 6, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "D", nProjeto: "G", fase: "H", percentual: "J" } },
    itemCols: { data: "B", tipo: "C", obs: "F", valor: "K" },
    tiers: [
      { n: 22, file: "tpl_prestacao_contas_22.xlsx", first: 30, adiant: 56 },
      { n: 30, file: "tpl_prestacao_contas_30.xlsx", first: 30, adiant: 64 },
      { n: 40, file: "tpl_prestacao_contas_40.xlsx", first: 30, adiant: 74 },
      { n: 60, file: "tpl_prestacao_contas_60.xlsx", first: 30, adiant: 94 },
      { n: 90, file: "tpl_prestacao_contas_90.xlsx", first: 30, adiant: 124 },
    ],
  },
  "reembolso": {
    sheet: "FORM 189",
    fileName: "solicitacao-reembolso.xlsx",
    motivoCell: "B15",
    rateio: { first: 20, max: 6, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "D", nProjeto: "G", fase: "H", percentual: "J" } },
    itemCols: { data: "B", tipo: "C", obs: "F", valor: "K" },
    tiers: [
      { n: 10, file: "tpl_reembolso_10.xlsx", first: 29 },
      { n: 22, file: "tpl_reembolso_22.xlsx", first: 29 },
      { n: 30, file: "tpl_reembolso_30.xlsx", first: 29 },
      { n: 40, file: "tpl_reembolso_40.xlsx", first: 29 },
      { n: 60, file: "tpl_reembolso_60.xlsx", first: 29 },
      { n: 90, file: "tpl_reembolso_90.xlsx", first: 29 },
    ],
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function parseDatePtBr(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }

  try {
    const form = FORMS[body.tipo];
    if (!form) return json({ error: `Tipo de formulário inválido: ${body.tipo}` }, 400);

    const profile = body.profile || {};
    const motivo = body.motivo || "";
    const rateio = Array.isArray(body.rateio) ? body.rateio : [];
    const itens = body.tipo === "solicitacao-adiantamento"
      ? (Array.isArray(body.previsoes) ? body.previsoes : [])
      : (Array.isArray(body.records) ? body.records : []);

    if (rateio.length > form.rateio.max) {
      return json({ error: `Este formulário comporta até ${form.rateio.max} linhas de rateio (foram enviadas ${rateio.length}).` }, 400);
    }

    // escolhe o menor modelo que comporte todos os lançamentos
    const tier = form.tiers.find((t) => itens.length <= t.n);
    if (!tier) {
      const maior = form.tiers[form.tiers.length - 1].n;
      return json({ error: `São ${itens.length} lançamentos e o maior modelo comporta ${maior}. Divida em mais de uma solicitação.` }, 400);
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(TEMPLATES_DIR, tier.file));
    const ws = wb.getWorksheet(form.sheet) || wb.worksheets[0];
    inserirLogo(wb, ws);

    // Dados da empresa e do solicitante
    ws.getCell("C6").value = profile.empresaUnidade || "";
    ws.getCell("C7").value = profile.departamento || "";
    ws.getCell("C8").value = profile.nome || "";
    ws.getCell("I8").value = profile.cpf || "";
    ws.getCell("K8").value = profile.telefone || "";
    ws.getCell("C9").value = profile.cargo || "";
    ws.getCell("I9").value = profile.agencia || "";
    ws.getCell("K9").value = profile.conta || "";
    ws.getCell("C10").value = profile.pix || "";
    ws.getCell("K10").value = profile.banco || "";
    ws.getCell(form.motivoCell).value = motivo;

    // Rateio
    const rc = form.rateio.cols;
    rateio.slice(0, form.rateio.max).forEach((r, i) => {
      const row = form.rateio.first + i;
      ws.getCell(`${rc.centroCusto}${row}`).value = r.centroCusto || "";
      ws.getCell(`${rc.nCentroCusto}${row}`).value = r.nCentroCusto || "";
      ws.getCell(`${rc.projeto}${row}`).value = r.projeto || "";
      ws.getCell(`${rc.nProjeto}${row}`).value = r.nProjeto || "";
      if (r.fase !== undefined && r.fase !== null && r.fase !== "") ws.getCell(`${rc.fase}${row}`).value = r.fase;
      const pct = Number(r.percentual);
      ws.getCell(`${rc.percentual}${row}`).value = isNaN(pct) ? "" : pct / 100;
    });

    // Detalhamento das despesas
    const ic = form.itemCols;
    itens.forEach((rec, i) => {
      const row = tier.first + i;
      if (ic.data) {
        const d = parseDatePtBr(rec.data);
        ws.getCell(`${ic.data}${row}`).value = d || rec.data || "";
      }
      if (ic.tipo) ws.getCell(`${ic.tipo}${row}`).value = rec.tipo || "";
      ws.getCell(`${ic.obs}${row}`).value = rec.obs || "";
      ws.getCell(`${ic.valor}${row}`).value = Number(rec.valor) || 0;
    });

    // Campos específicos
    // (o TOTAL GERAL do adiantamento é calculado pela própria fórmula do formulário)
    if (tier.adiant) {
      ws.getCell(`K${tier.adiant}`).value = Number(body.valorAdiantamento) || 0;
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${form.fileName}"`,
      },
    });
  } catch (err) {
    // devolve o motivo real em vez de deixar a função quebrar com 502
    return json({ error: `Erro ao gerar a planilha: ${String(err && err.message || err)}` }, 500);
  }
};
