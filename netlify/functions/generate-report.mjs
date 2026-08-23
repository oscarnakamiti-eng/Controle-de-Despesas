// Netlify Function (v2) — preenche os formulários oficiais (FORM 189).
//
// Os modelos .xlsx trazem marcadores (@@CELULA@@) nas células preenchíveis.
// Aqui apenas descompactamos o arquivo, substituímos os marcadores no XML da
// planilha e recompactamos. Nenhuma biblioteca de Excel é usada — o arquivo sai
// idêntico ao original em formatação, fórmulas, mesclagens e logomarca.
//
// POST { tipo, profile, motivo, valorAdiantamento, rateio: [...], records: [...], previsoes: [...], historyId? }
// Com historyId, a planilha gerada também é arquivada em hist-file:<historyId>:xlsx.

import { unzipSync, zipSync } from "fflate";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { getStore } from "@netlify/blobs";

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "templates");

const FORMS = {
  "solicitacao-adiantamento": {
    fileName: "solicitacao-adiantamento.xlsx",
    motivo: "B16",
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
    fileName: "prestacao-contas-adiantamento.xlsx",
    motivo: "B16",
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
    fileName: "solicitacao-reembolso.xlsx",
    motivo: "B15",
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

function escaparXml(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Aceita "12,5" (vírgula, como o resto do app) além de "12.5"
function parsePercentual(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(String(raw).trim().replace(",", "."));
  return isNaN(n) ? null : n;
}

// Data no formato DD/MM/AAAA -> número de série do Excel
function serialDeData(str) {
  const m = String(str || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(dt)) return null;
  return Math.round((dt - Date.UTC(1899, 11, 30)) / 86400000);
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }

  try {
    const form = FORMS[body.tipo];
    if (!form) return json({ error: `Tipo de formulário inválido: ${body.tipo}` }, 400);

    const profile = body.profile || {};
    const rateio = Array.isArray(body.rateio) ? body.rateio : [];
    const itens = body.tipo === "solicitacao-adiantamento"
      ? (Array.isArray(body.previsoes) ? body.previsoes : [])
      : (Array.isArray(body.records) ? body.records : []);

    if (rateio.length > form.rateio.max) {
      return json({ error: `Este formulário comporta até ${form.rateio.max} linhas de rateio (foram enviadas ${rateio.length}).` }, 400);
    }

    const tier = form.tiers.find((t) => itens.length <= t.n);
    if (!tier) {
      const maior = form.tiers[form.tiers.length - 1].n;
      return json({ error: `São ${itens.length} lançamentos e o maior modelo comporta ${maior}. Divida em mais de uma solicitação.` }, 400);
    }

    // ---- monta os valores por célula ----
    const texto = {};   // conteúdo textual
    const numero = {};  // conteúdo numérico (valores, datas, percentuais)

    texto["C6"] = profile.empresaUnidade || "";
    texto["C7"] = profile.departamento || "";
    texto["C8"] = profile.nome || "";
    texto["I8"] = profile.cpf || "";
    texto["K8"] = profile.telefone || "";
    texto["C9"] = profile.cargo || "";
    texto["I9"] = profile.agencia || "";
    texto["K9"] = profile.conta || "";
    texto["C10"] = profile.pix || "";
    texto["K10"] = profile.banco || "";
    texto[form.motivo] = body.motivo || "";

    const rc = form.rateio.cols;
    rateio.slice(0, form.rateio.max).forEach((r, i) => {
      const row = form.rateio.first + i;
      texto[`${rc.centroCusto}${row}`] = r.centroCusto || "";
      texto[`${rc.nCentroCusto}${row}`] = r.nCentroCusto || "";
      texto[`${rc.projeto}${row}`] = r.projeto || "";
      texto[`${rc.nProjeto}${row}`] = r.nProjeto || "";
      texto[`${rc.fase}${row}`] = (r.fase === undefined || r.fase === null) ? "" : r.fase;
      const pct = parsePercentual(r.percentual);
      if (pct !== null) numero[`${rc.percentual}${row}`] = pct / 100;
    });

    const ic = form.itemCols;
    itens.forEach((rec, i) => {
      const row = tier.first + i;
      if (ic.data) {
        const serial = serialDeData(rec.data);
        if (serial !== null) numero[`${ic.data}${row}`] = serial;
      }
      if (ic.tipo) texto[`${ic.tipo}${row}`] = rec.tipo || "";
      texto[`${ic.obs}${row}`] = rec.obs || "";
      numero[`${ic.valor}${row}`] = Number(rec.valor) || 0;
    });

    if (tier.adiant) {
      numero[`K${tier.adiant}`] = Number(body.valorAdiantamento) || 0;
    }

    // ---- substitui os marcadores no XML da planilha ----
    const zipBytes = fs.readFileSync(path.join(TEMPLATES_DIR, tier.file));
    const arquivos = unzipSync(new Uint8Array(zipBytes));

    const nomeSheet = Object.keys(arquivos).find(
      (n) => n.startsWith("xl/worksheets/sheet") && n.endsWith(".xml")
    );
    if (!nomeSheet) return json({ error: "Modelo inválido: planilha não encontrada." }, 500);

    let xml = new TextDecoder("utf-8").decode(arquivos[nomeSheet]);

    // números: <v>@@REF@@</v> -> <v>123.45</v>; sem valor, a célula fica vazia
    xml = xml.replace(/<v>@@([A-Z]+\d+)@@<\/v>/g, (_, ref) =>
      Object.prototype.hasOwnProperty.call(numero, ref) ? `<v>${numero[ref]}</v>` : ""
    );
    // textos: @@REF@@ -> conteúdo escapado (ou vazio)
    xml = xml.replace(/@@([A-Z]+\d+)@@/g, (_, ref) =>
      Object.prototype.hasOwnProperty.call(texto, ref) ? escaparXml(texto[ref]) : ""
    );

    arquivos[nomeSheet] = new TextEncoder().encode(xml);
    const saida = zipSync(arquivos, { level: 6 });

    if (body.historyId) {
      try {
        const store = getStore("expense-tracker");
        await store.set(`hist-file:${body.historyId}:xlsx`, Buffer.from(saida));
      } catch { /* não impede o download */ }
    }

    return new Response(saida, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${form.fileName}"`,
      },
    });
  } catch (err) {
    return json({ error: `Erro ao gerar a planilha: ${String((err && err.message) || err)}` }, 500);
  }
};
