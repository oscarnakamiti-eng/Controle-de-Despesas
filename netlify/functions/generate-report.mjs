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
      { n: 9,  file: "tpl_solicitacao_adiantamento_9.xlsx",  first: 34, assinaturaRow: 54 },
      { n: 20, file: "tpl_solicitacao_adiantamento_20.xlsx", first: 34, assinaturaRow: 65 },
      { n: 40, file: "tpl_solicitacao_adiantamento_40.xlsx", first: 34, assinaturaRow: 85 },
      { n: 60, file: "tpl_solicitacao_adiantamento_60.xlsx", first: 34, assinaturaRow: 105 },
    ],
  },
  "prestacao-contas": {
    fileName: "prestacao-contas-adiantamento.xlsx",
    motivo: "B16",
    rateio: { first: 21, max: 6, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "D", nProjeto: "G", fase: "H", percentual: "J" } },
    itemCols: { data: "B", tipo: "C", obs: "F", valor: "K" },
    tiers: [
      { n: 22, file: "tpl_prestacao_contas_22.xlsx", first: 30, adiant: 56, assinaturaRow: 67 },
      { n: 30, file: "tpl_prestacao_contas_30.xlsx", first: 30, adiant: 64, assinaturaRow: 75 },
      { n: 40, file: "tpl_prestacao_contas_40.xlsx", first: 30, adiant: 74, assinaturaRow: 85 },
      { n: 60, file: "tpl_prestacao_contas_60.xlsx", first: 30, adiant: 94, assinaturaRow: 105 },
      { n: 90, file: "tpl_prestacao_contas_90.xlsx", first: 30, adiant: 124, assinaturaRow: 135 },
    ],
  },
  "reembolso": {
    fileName: "solicitacao-reembolso.xlsx",
    motivo: "B15",
    rateio: { first: 20, max: 6, cols: { centroCusto: "A", nCentroCusto: "B", projeto: "D", nProjeto: "G", fase: "H", percentual: "J" } },
    itemCols: { data: "B", tipo: "C", obs: "F", valor: "K" },
    tiers: [
      { n: 10, file: "tpl_reembolso_10.xlsx", first: 29, assinaturaRow: 51 },
      { n: 22, file: "tpl_reembolso_22.xlsx", first: 29, assinaturaRow: 63 },
      { n: 30, file: "tpl_reembolso_30.xlsx", first: 29, assinaturaRow: 71 },
      { n: 40, file: "tpl_reembolso_40.xlsx", first: 29, assinaturaRow: 81 },
      { n: 60, file: "tpl_reembolso_60.xlsx", first: 29, assinaturaRow: 101 },
      { n: 90, file: "tpl_reembolso_90.xlsx", first: 29, assinaturaRow: 131 },
    ],
  },
};

// Linha (1-indexado) da caixa "SOLICITANTE" na área de assinaturas: sempre
// 2 linhas abaixo do cabeçalho "ASSINATURAS*" nesses modelos (cabeçalho,
// espaçador, caixa de assinatura com "DATA:" + TODAY()). Confirmado nos 15
// modelos ao inspecionar o XML de cada um.

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

const EMU_POR_PONTO = 12700;

// Cola a imagem da assinatura na caixa "SOLICITANTE" da área de assinaturas,
// via XML puro (media + drawing + relacionamentos), na mesma linha do
// preenchimento por marcadores — sem nenhuma biblioteca de Excel.
function injetarAssinatura(arquivos, nomeSheet, xml, linha, assinatura) {
  const linhaZeroIdx = linha - 1;
  const alturaMatch = xml.match(new RegExp(`<row r="${linha}"[^>]*\\bht="([\\d.]+)"`));
  const alturaLinhaEmu = (alturaMatch ? parseFloat(alturaMatch[1]) : 20) * EMU_POR_PONTO;

  const alturaImgEmu = Math.round(alturaLinhaEmu * 0.75);
  const larguraImgEmu = Math.round(alturaImgEmu * (assinatura.width / assinatura.height));
  const offsetTopoEmu = Math.round((alturaLinhaEmu - alturaImgEmu) / 2);
  const offsetEsquerdaEmu = 36000; // ~1mm de margem

  const ehPng = assinatura.mediaType === "image/png";
  const extensao = ehPng ? "png" : "jpeg";
  const nomeMidia = `xl/media/assinatura.${extensao}`;
  const nomeDrawing = "xl/drawings/drawing1.xml";
  const nomeDrawingRels = "xl/drawings/_rels/drawing1.xml.rels";
  const nomeSheetRels = nomeSheet.replace("xl/worksheets/", "xl/worksheets/_rels/") + ".rels";

  arquivos[nomeMidia] = assinatura.bytes;

  const drawingXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<xdr:oneCellAnchor>" +
    `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>${offsetEsquerdaEmu}</xdr:colOff>` +
    `<xdr:row>${linhaZeroIdx}</xdr:row><xdr:rowOff>${offsetTopoEmu}</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${larguraImgEmu}" cy="${alturaImgEmu}"/>` +
    "<xdr:pic>" +
    '<xdr:nvPicPr><xdr:cNvPr id="1" name="Assinatura"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
    '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${larguraImgEmu}" cy="${alturaImgEmu}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>' +
    "</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>";
  arquivos[nomeDrawing] = new TextEncoder().encode(drawingXml);

  arquivos[nomeDrawingRels] = new TextEncoder().encode(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/assinatura.${extensao}"/>` +
    "</Relationships>"
  );

  arquivos[nomeSheetRels] = new TextEncoder().encode(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdAssinatura" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
    "</Relationships>"
  );

  let tipos = new TextDecoder("utf-8").decode(arquivos["[Content_Types].xml"]);
  let extras = "";
  if (!new RegExp(`Extension="${extensao}"`).test(tipos)) {
    extras += `<Default Extension="${extensao}" ContentType="image/${extensao}"/>`;
  }
  extras += '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
  tipos = tipos.replace("</Types>", `${extras}</Types>`);
  arquivos["[Content_Types].xml"] = new TextEncoder().encode(tipos);

  let sheetXml = xml.replace(
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  );
  sheetXml = sheetXml.replace("</worksheet>", '<drawing r:id="rIdAssinatura"/></worksheet>');
  return sheetXml;
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

    // ---- cola a assinatura salva na caixa do solicitante, se houver ----
    if (tier.assinaturaRow) {
      try {
        const store = getStore("expense-tracker");
        const assinaturaBuf = await store.get("assinatura", { type: "arrayBuffer" });
        if (assinaturaBuf) {
          const meta = (await store.get("assinatura-meta", { type: "json" })) || {};
          if (meta.width && meta.height) {
            xml = injetarAssinatura(arquivos, nomeSheet, xml, tier.assinaturaRow, {
              bytes: new Uint8Array(assinaturaBuf), mediaType: meta.mediaType, width: meta.width, height: meta.height,
            });
          }
        }
      } catch { /* sem assinatura configurada ou falha ao buscá-la — segue sem ela */ }
    }

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
