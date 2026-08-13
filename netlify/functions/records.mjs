// Netlify Function (v2) — persiste a lista de lançamentos usando Netlify Blobs.
// GET  -> devolve { records: [...] }
// POST -> recebe { records: [...] } e substitui o conteúdo salvo

import { getStore } from "@netlify/blobs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const records = (await store.get("records", { type: "json" })) || [];
    return json({ records });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corpo da requisição inválido" }, 400);
    }
    const records = Array.isArray(body.records) ? body.records : [];
    await store.setJSON("records", records);
    return json({ ok: true, count: records.length });
  }

  return json({ error: "Método não permitido" }, 405);
};
