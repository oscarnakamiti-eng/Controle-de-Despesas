// Netlify Function (v2) — histórico das planilhas/relatórios já gerados.
// Os arquivos (xlsx/pdf) são gravados diretamente pelas funções que os geram
// (generate-report.mjs e generate-photo-report.mjs); aqui só guardamos o
// índice (metadados + os lançamentos usados, pra poder "reabrir" depois).
//
// GET  -> { items: [...] } (sem os bytes dos arquivos)
// GET  ?id=<id>&file=xlsx|pdf -> baixa o arquivo arquivado
// POST -> registra uma entrada nova no índice
// DELETE ?id=<id> -> remove a entrada e os arquivos arquivados

import { getStore } from "@netlify/blobs";

const INDEX_KEY = "historico";
const LIMITE_ITENS = 100;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  // Consistência forte: o item precisa aparecer na lista assim que é
  // registrado (logo depois de gerar a planilha), sem esperar propagação.
  const store = getStore("expense-tracker", { consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = url.searchParams.get("id");
    const file = url.searchParams.get("file");
    if (id && file) {
      if (file !== "xlsx" && file !== "pdf") return json({ error: "Parâmetro file deve ser xlsx ou pdf" }, 400);
      const buf = await store.get(`hist-file:${id}:${file}`, { type: "arrayBuffer" });
      if (!buf) return new Response("Arquivo não encontrado", { status: 404 });
      const ct = file === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      return new Response(buf, {
        status: 200,
        headers: { "Content-Type": ct, "Content-Disposition": `attachment; filename="historico-${id}.${file}"` },
      });
    }
    const items = (await store.get(INDEX_KEY, { type: "json" })) || [];
    return json({ items });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const id = body.historyId;
    if (!id) return json({ error: "historyId ausente" }, 400);

    const entry = {
      id,
      criadoEm: new Date().toISOString(),
      tipo: body.tipo || "",
      motivo: body.motivo || "",
      valorAdiantamento: Number(body.valorAdiantamento) || 0,
      rateio: Array.isArray(body.rateio) ? body.rateio : [],
      records: Array.isArray(body.records) ? body.records : [],
      previsoes: Array.isArray(body.previsoes) ? body.previsoes : [],
      totalGeral: Number(body.totalGeral) || 0,
      xlsxNome: body.xlsxNome || "relatorio.xlsx",
      temPdf: !!body.temPdf,
    };

    const items = (await store.get(INDEX_KEY, { type: "json" })) || [];
    items.unshift(entry);
    if (items.length > LIMITE_ITENS) items.length = LIMITE_ITENS;
    await store.setJSON(INDEX_KEY, items);
    return json({ ok: true, id });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parâmetro id ausente" }, 400);
    await store.delete(`hist-file:${id}:xlsx`);
    await store.delete(`hist-file:${id}:pdf`);
    const items = (await store.get(INDEX_KEY, { type: "json" })) || [];
    await store.setJSON(INDEX_KEY, items.filter((it) => it.id !== id));
    return json({ ok: true });
  }

  return json({ error: "Método não permitido" }, 405);
};
