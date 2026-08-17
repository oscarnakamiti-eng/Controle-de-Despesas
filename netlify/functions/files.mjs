// Netlify Function (v2) — serve e apaga os arquivos originais dos comprovantes
// (guardados pela extract.mjs), usados na pré-visualização e no relatório fotográfico.
// GET    /.netlify/functions/files?id=<id>   -> devolve os bytes do arquivo
// DELETE /.netlify/functions/files?id=<id>   -> remove o arquivo e seus metadados

import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Parâmetro id ausente" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const buffer = await store.get(`file:${id}`, { type: "arrayBuffer" });
    if (!buffer) return new Response("Arquivo não encontrado", { status: 404 });
    const meta = (await store.get(`file-meta:${id}`, { type: "json" })) || {};
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": meta.mediaType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (req.method === "DELETE") {
    await store.delete(`file:${id}`);
    await store.delete(`file-meta:${id}`);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: { "Content-Type": "application/json" } });
};
