// Netlify Function (v2) — guarda a imagem da assinatura do solicitante, usada
// para preencher automaticamente o campo de assinatura nas planilhas oficiais.
// GET    -> serve a imagem (para pré-visualização)
// POST   { base64, mediaType, width, height } -> grava/substitui a assinatura
// DELETE -> remove a assinatura salva

import { getStore } from "@netlify/blobs";

const KEY = "assinatura";
const META_KEY = "assinatura-meta";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const buffer = await store.get(KEY, { type: "arrayBuffer" });
    if (!buffer) return new Response(null, { status: 404 });
    const meta = (await store.get(META_KEY, { type: "json" })) || {};
    return new Response(buffer, {
      status: 200,
      headers: { "Content-Type": meta.mediaType || "image/png", "Cache-Control": "private, max-age=60" },
    });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const { base64, mediaType, width, height } = body || {};
    if (!base64) return json({ error: "Imagem (base64) ausente" }, 400);
    const w = Number(width), h = Number(height);
    if (!w || !h) return json({ error: "Dimensões (width/height) da imagem são obrigatórias" }, 400);
    try {
      await store.set(KEY, Buffer.from(base64, "base64"));
      await store.setJSON(META_KEY, { mediaType: mediaType || "image/png", width: w, height: h });
      return json({ ok: true });
    } catch (err) {
      return json({ error: `Falha ao gravar a assinatura: ${String(err.message || err)}` }, 500);
    }
  }

  if (req.method === "DELETE") {
    await store.delete(KEY);
    await store.delete(META_KEY);
    return json({ ok: true });
  }

  return json({ error: "Método não permitido" }, 405);
};
