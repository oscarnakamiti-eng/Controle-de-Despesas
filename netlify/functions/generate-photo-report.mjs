// Netlify Function (v2) — gera o relatório fotográfico em PDF a partir dos
// comprovantes já guardados nos Blobs. Recebe só os identificadores das
// páginas (não as imagens), pra não esbarrar no limite de payload do Lambda.
//
// POST { pages: [{ id, page, mediaType, data, tipo, valor, obs }, ...] }

import { getStore } from "@netlify/blobs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const LARGURA = 595.28, ALTURA = 841.89; // A4 em pontos
const MARGEM = 36;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function ehPng(bytes) {
  return bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

// Mantém só caracteres que a fonte padrão (WinAnsi) sabe desenhar, pra um
// caractere estranho na observação não derrubar a geração do PDF inteiro.
function textoSeguro(s) {
  return String(s || "").replace(/[^\x20-\x7EÀ-ÿ]/g, "").slice(0, 160);
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
  if (pages.length === 0) return json({ error: "Nenhuma página para gerar o relatório." }, 400);

  try {
    const store = getStore("expense-tracker");
    const pdfDoc = await PDFDocument.create();
    const fonte = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    for (const p of pages) {
      const page = pdfDoc.addPage([LARGURA, ALTURA]);
      const topo = ALTURA - MARGEM;
      const temObs = !!p.obs;

      const valorFmt = (Number(p.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const legenda = textoSeguro(`${p.data || ""}   -   ${p.tipo || ""}   -   R$ ${valorFmt}`);

      if (temObs) {
        try {
          page.drawText(textoSeguro(p.obs), { x: MARGEM, y: topo - 10, size: 9, font: fonte, color: rgb(0.3, 0.3, 0.35) });
        } catch { /* caractere não suportado: segue sem a observação */ }
      }

      const yImagemTopo = topo - (temObs ? 30 : 10);
      const yImagemBase = MARGEM + 30;
      const centroY = (yImagemTopo + yImagemBase) / 2;

      const bytes = await buscarImagem(store, p);
      let img = null;
      if (bytes) {
        try { img = ehPng(bytes) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes); }
        catch { img = null; }
      }

      if (img) {
        const areaW = LARGURA - MARGEM * 2;
        const areaH = yImagemTopo - yImagemBase;
        const escala = Math.min(areaW / img.width, areaH / img.height, 1);
        const w = img.width * escala, h = img.height * escala;
        page.drawImage(img, { x: (LARGURA - w) / 2, y: yImagemBase + (areaH - h) / 2, width: w, height: h });
      } else {
        try {
          page.drawText("Comprovante indisponível para este lançamento.", { x: MARGEM, y: centroY, size: 10, font: fonte, color: rgb(0.5, 0.1, 0.1) });
        } catch { /* ignora */ }
      }

      try {
        page.drawText(legenda, { x: MARGEM, y: MARGEM + 14, size: 11, font: fonteNegrito, color: rgb(0.1, 0.1, 0.15) });
      } catch { /* ignora */ }
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-fotografico.pdf"`,
      },
    });
  } catch (err) {
    return json({ error: `Erro ao gerar o relatório em PDF: ${String((err && err.message) || err)}` }, 500);
  }
};
