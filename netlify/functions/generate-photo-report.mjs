// Netlify Function (v2) — gera o relatório fotográfico em PDF a partir dos
// comprovantes já guardados nos Blobs. Recebe só os identificadores das
// páginas (não as imagens), pra não esbarrar no limite de payload do Lambda.
//
// POST { pages: [{ id, page, mediaType, data, tipo, valor, obs }, ...], xlsxBase64? }
// Com xlsxBase64, a planilha é convertida em PDF (via CloudConvert) e vira a
// primeira página do relatório. Sem CLOUDCONVERT_API_KEY configurada, ou se a
// conversão falhar, o relatório sai normalmente só com as fotos.

import { getStore } from "@netlify/blobs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const LARGURA = 595.28, ALTURA = 841.89; // A4 em pontos
const MARGEM = 36;
const CLOUDCONVERT_API = "https://api.cloudconvert.com/v2";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Converte o .xlsx em PDF via CloudConvert: cria um job (import/upload ->
// convert -> export/url), envia o arquivo, espera terminar (poll simples) e
// baixa o PDF resultante. Devolve null sem chave configurada.
async function converterXlsxParaPdf(xlsxBytes) {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) return null;

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const jobRes = await fetch(`${CLOUDCONVERT_API}/jobs`, {
    method: "POST", headers,
    body: JSON.stringify({
      tasks: {
        importar: { operation: "import/upload" },
        converter: { operation: "convert", input: "importar", input_format: "xlsx", output_format: "pdf" },
        exportar: { operation: "export/url", input: "converter" },
      },
    }),
  });
  if (!jobRes.ok) throw new Error(`falha ao criar o job (HTTP ${jobRes.status}): ${await jobRes.text().catch(() => "")}`);
  let job = (await jobRes.json()).data;

  const tarefaImportar = job.tasks.find((t) => t.operation === "import/upload");
  if (!tarefaImportar || !tarefaImportar.result || !tarefaImportar.result.form) {
    throw new Error("resposta do CloudConvert sem os dados de upload esperados");
  }
  const { url: uploadUrl, parameters } = tarefaImportar.result.form;
  const formData = new FormData();
  for (const [k, v] of Object.entries(parameters)) formData.append(k, String(v));
  formData.append(
    "file",
    new Blob([xlsxBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "planilha.xlsx"
  );
  const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!uploadRes.ok) throw new Error(`falha no upload (HTTP ${uploadRes.status})`);

  for (let i = 0; i < 25 && job.status !== "finished" && job.status !== "error"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const statusRes = await fetch(`${CLOUDCONVERT_API}/jobs/${job.id}`, { headers });
    if (!statusRes.ok) throw new Error(`falha ao consultar o job (HTTP ${statusRes.status})`);
    job = (await statusRes.json()).data;
  }
  if (job.status !== "finished") throw new Error(`conversão não terminou a tempo (status: ${job.status})`);

  const tarefaExportar = job.tasks.find((t) => t.operation === "export/url");
  const arquivo = tarefaExportar && tarefaExportar.result && tarefaExportar.result.files && tarefaExportar.result.files[0];
  if (!arquivo) throw new Error("job terminou mas não devolveu um arquivo exportado");

  const pdfRes = await fetch(arquivo.url);
  if (!pdfRes.ok) throw new Error(`falha ao baixar o PDF convertido (HTTP ${pdfRes.status})`);
  return new Uint8Array(await pdfRes.arrayBuffer());
}

function ehPng(bytes) {
  return bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

// Mantém só caracteres que a fonte padrão (WinAnsi) sabe desenhar, pra um
// caractere estranho na observação não derrubar a geração do PDF inteiro.
function textoSeguro(s) {
  return String(s || "").replace(/[^\x20-\x7EÀ-ÿ]/g, "").slice(0, 160);
}

// Encolhe o tamanho da fonte até o texto caber na largura disponível.
function ajustarTamanho(font, texto, tamanhoInicial, larguraMax, minimo = 7) {
  let tamanho = tamanhoInicial;
  while (tamanho > minimo && font.widthOfTextAtSize(texto, tamanho) > larguraMax) tamanho -= 1;
  return tamanho;
}

async function buscarImagem(store, p) {
  const isPdf = p.mediaType === "application/pdf";
  const bytes = isPdf
    ? await store.get(`preview:${p.id}:${p.page || 1}`, { type: "arrayBuffer" })
    : await store.get(`file:${p.id}`, { type: "arrayBuffer" });
  return bytes ? new Uint8Array(bytes) : null;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }

  const pages = Array.isArray(body.pages) ? body.pages : [];
  const xlsxBase64 = typeof body.xlsxBase64 === "string" && body.xlsxBase64 ? body.xlsxBase64 : null;
  if (pages.length === 0 && !xlsxBase64) return json({ error: "Nada para gerar." }, 400);

  try {
    const store = getStore("expense-tracker");

    // A planilha convertida (se pedida e se der certo) vira a base do PDF, e
    // as fotos dos comprovantes são adicionadas depois — assim ela sai como
    // primeira página. Sem chave configurada, ou se a conversão falhar, o
    // relatório segue normalmente só com as fotos (não trava por causa disso).
    let pdfDoc = null;
    let avisoConversao = null;
    let temPaginaXlsx = false;
    if (xlsxBase64) {
      try {
        const pdfConvertido = await converterXlsxParaPdf(Buffer.from(xlsxBase64, "base64"));
        if (pdfConvertido) {
          pdfDoc = await PDFDocument.load(pdfConvertido);
          // A planilha tem mais de uma aba (ex.: "Histórico de Revisão") e o
          // CloudConvert converte todas — só a primeira página (o formulário
          // em si) deve entrar no relatório.
          for (let i = pdfDoc.getPageCount() - 1; i >= 1; i--) pdfDoc.removePage(i);
          temPaginaXlsx = pdfDoc.getPageCount() > 0;
        } else {
          avisoConversao = "CLOUDCONVERT_API_KEY não configurada — relatório gerado sem a página da planilha.";
        }
      } catch (err) {
        avisoConversao = `Não foi possível converter a planilha em PDF: ${String((err && err.message) || err)}`;
      }
    }
    if (!pdfDoc) pdfDoc = await PDFDocument.create();

    const fonte = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const totalPaginas = (temPaginaXlsx ? 1 : 0) + pages.length;
    let indicePagina = temPaginaXlsx ? 1 : 0;

    for (const p of pages) {
      indicePagina++;
      const page = pdfDoc.addPage([LARGURA, ALTURA]);
      const topo = ALTURA - MARGEM;
      const larguraDisponivel = LARGURA - MARGEM * 2;
      const temObs = !!p.obs;

      // Cabeçalho: data e tipo, alinhado à esquerda.
      try {
        const cabecalho = textoSeguro(`${p.data || ""}   -   ${p.tipo || ""}`);
        const tam = ajustarTamanho(fonteNegrito, cabecalho, 11, larguraDisponivel);
        page.drawText(cabecalho, { x: MARGEM, y: topo - 10, size: tam, font: fonteNegrito, color: rgb(0.1, 0.1, 0.15) });
      } catch { /* ignora */ }

      // Legenda: histórico (observação), centralizada.
      if (temObs) {
        try {
          const textoObs = textoSeguro(p.obs);
          const tam = ajustarTamanho(fonte, textoObs, 10, larguraDisponivel);
          const x = (LARGURA - fonte.widthOfTextAtSize(textoObs, tam)) / 2;
          page.drawText(textoObs, { x, y: topo - 28, size: tam, font: fonte, color: rgb(0.3, 0.3, 0.35) });
        } catch { /* caractere não suportado: segue sem a legenda */ }
      }

      const yImagemTopo = topo - (temObs ? 45 : 25);
      const yImagemBase = MARGEM + 24;
      const centroY = (yImagemTopo + yImagemBase) / 2;

      const bytes = await buscarImagem(store, p);
      let img = null;
      if (bytes) {
        try { img = ehPng(bytes) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes); }
        catch { img = null; }
      }

      if (img) {
        const areaH = yImagemTopo - yImagemBase;
        const escala = Math.min(larguraDisponivel / img.width, areaH / img.height, 1);
        const w = img.width * escala, h = img.height * escala;
        page.drawImage(img, { x: (LARGURA - w) / 2, y: yImagemBase + (areaH - h) / 2, width: w, height: h });
      } else {
        try {
          page.drawText("Comprovante indisponível para este lançamento.", { x: MARGEM, y: centroY, size: 10, font: fonte, color: rgb(0.5, 0.1, 0.1) });
        } catch { /* ignora */ }
      }

      // Rodapé: numeração de página, centralizada.
      try {
        const textoPagina = `Página ${indicePagina} de ${totalPaginas}`;
        const tam = ajustarTamanho(fonte, textoPagina, 10, larguraDisponivel);
        const x = (LARGURA - fonte.widthOfTextAtSize(textoPagina, tam)) / 2;
        page.drawText(textoPagina, { x, y: MARGEM + 10, size: tam, font: fonte, color: rgb(0.4, 0.4, 0.45) });
      } catch { /* ignora */ }
    }

    const pdfBytes = await pdfDoc.save();

    const headers = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-fotografico.pdf"`,
    };
    // Aviso não-fatal (ex.: a página da planilha não pôde ser incluída) vai
    // num header, já que a resposta em si é o PDF binário.
    if (avisoConversao) headers["X-Aviso"] = encodeURIComponent(avisoConversao);

    return new Response(pdfBytes, { status: 200, headers });
  } catch (err) {
    return json({ error: `Erro ao gerar o relatório em PDF: ${String((err && err.message) || err)}` }, 500);
  }
};
