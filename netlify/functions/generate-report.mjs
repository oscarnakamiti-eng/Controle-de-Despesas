// Netlify Function (v2) — preenche os formulários oficiais (FORM 189) preservando
// integralmente o layout original: fórmulas, bordas, formatos e a logomarca.
//
// POST { tipo, profile, motivo, valorAdiantamento, rateio: [...], records: [...], previsoes: [...] }
//   tipo: "solicitacao-adiantamento" | "prestacao-contas" | "reembolso"
// Resposta: binário .xlsx pronto para download.

import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mapa de cada formulário: onde fica cada campo na planilha oficial
const FORMS = {
  "solicitacao-adiantamento": {
    file: "tpl_solicitacao_adiantamento.xlsx",
    sheet: "ADIANTAMENTO",
    fileName: "solicitacao-adiantamento.xlsx",
    motivoCell: "B16",
    rateio: { first: 21, max: 10, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "E", nProjeto: "G", fase: "H", percentual: "J" } },
    // este formulário lista despesas PREVISTAS: apenas histórico + valor
    itens: { first: 34, max: 9, cols: { obs: "B", valor: "K" } },
    totalCell: "K46",
  },
  "prestacao-contas": {
    file: "tpl_prestacao_contas.xlsx",
    sheet: "PRESTAÇÃO CONTAS ADIANTAMENTO",
    fileName: "prestacao-contas-adiantamento.xlsx",
    motivoCell: "B16",
    rateio: { first: 21, max: 6, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "D", nProjeto: "G", fase: "H", percentual: "J" } },
    itens: { first: 30, max: 22, cols: { data: "B", tipo: "C", obs: "F", valor: "K" } },
    adiantamentoCell: "K56",
  },
  "reembolso": {
    file: "tpl_reembolso.xlsx",
    sheet: "FORM 189",
    fileName: "solicitacao-reembolso.xlsx",
    motivoCell: "B15",
    rateio: { first: 20, max: 6, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "D", nProjeto: "G", fase: "H", percentual: "J" } },
    itens: { first: 29, max: 22, cols: { data: "B", tipo: "C", obs: "F", valor: "K" } },
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

  const form = FORMS[body.tipo];
  if (!form) return json({ error: `Tipo de formulário inválido: ${body.tipo}` }, 400);

  const profile = body.profile || {};
  const motivo = body.motivo || "";
  const rateio = Array.isArray(body.rateio) ? body.rateio : [];
  // "previsoes" só é usado na solicitação de adiantamento; os demais usam "records"
  const itens = body.tipo === "solicitacao-adiantamento"
    ? (Array.isArray(body.previsoes) ? body.previsoes : [])
    : (Array.isArray(body.records) ? body.records : []);

  if (rateio.length > form.rateio.max) {
    return json({ error: `Este formulário comporta até ${form.rateio.max} linhas de rateio (foram enviadas ${rateio.length}).` }, 400);
  }
  if (itens.length > form.itens.max) {
    return json({ error: `Este formulário comporta até ${form.itens.max} lançamentos (foram enviados ${itens.length}). Divida em mais de uma solicitação.` }, 400);
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(path.join(__dirname, "templates", form.file));
  } catch (err) {
    return json({ error: `Não foi possível carregar o modelo ${form.file}: ${String(err.message || err)}` }, 500);
  }
  const ws = wb.getWorksheet(form.sheet) || wb.worksheets[0];

  // --- Dados da empresa e do solicitante ---
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

  // --- Rateio ---
  const rc = form.rateio.cols;
  rateio.slice(0, form.rateio.max).forEach((r, i) => {
    const row = form.rateio.first + i;
    ws.getCell(`${rc.centroCusto}${row}`).value = r.centroCusto || "";
    ws.getCell(`${rc.nCentroCusto}${row}`).value = r.nCentroCusto || "";
    ws.getCell(`${rc.projeto}${row}`).value = r.projeto || "";
    ws.getCell(`${rc.nProjeto}${row}`).value = r.nProjeto || "";
    if (r.fase !== undefined && r.fase !== null && r.fase !== "") ws.getCell(`${rc.fase}${row}`).value = r.fase;
    const pct = Number(r.percentual);
    ws.getCell(`${rc.percentual}${row}`).value = isNaN(pct) ? "" : pct / 100;  // formato % espera fração
  });

  // --- Detalhamento das despesas ---
  const ic = form.itens.cols;
  itens.slice(0, form.itens.max).forEach((rec, i) => {
    const row = form.itens.first + i;
    if (ic.data) {
      const d = parseDatePtBr(rec.data);
      ws.getCell(`${ic.data}${row}`).value = d || rec.data || "";
    }
    if (ic.tipo) ws.getCell(`${ic.tipo}${row}`).value = rec.tipo || "";
    ws.getCell(`${ic.obs}${row}`).value = rec.obs || "";
    ws.getCell(`${ic.valor}${row}`).value = Number(rec.valor) || 0;
  });

  // --- Campos específicos por formulário ---
  if (form.totalCell) {
    // Solicitação de adiantamento: total geral do adiantamento solicitado
    const total = Number(body.valorAdiantamento);
    ws.getCell(form.totalCell).value = isNaN(total) || !total
      ? itens.reduce((s, r) => s + (Number(r.valor) || 0), 0)
      : total;
  }
  if (form.adiantamentoCell) {
    // Prestação de contas: valor que havia sido adiantado (usado no SALDO FINAL)
    ws.getCell(form.adiantamentoCell).value = Number(body.valorAdiantamento) || 0;
  }

  let buffer;
  try {
    buffer = await wb.xlsx.writeBuffer();
  } catch (err) {
    return json({ error: `Falha ao gerar o arquivo: ${String(err.message || err)}` }, 500);
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${form.fileName}"`,
    },
  });
};
