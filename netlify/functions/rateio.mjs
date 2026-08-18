// Netlify Function (v2) — guarda a lista de presets de rateio (centro de custo,
// projeto, fase, percentual por usina/obra), reutilizados na hora de gerar as
// planilhas oficiais sem precisar redigitar toda vez.
// GET  -> devolve { presets: [...] }
// POST -> recebe { presets: [...] } e substitui a lista salva

import { getStore } from "@netlify/blobs";

const KEY = "rateio-presets";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const presets = (await store.get(KEY, { type: "json" })) || [];
    return json({ presets });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const presets = Array.isArray(body.presets) ? body.presets : [];
    await store.setJSON(KEY, presets);
    return json({ ok: true, count: presets.length });
  }

  return json({ error: "Método não permitido" }, 405);
};
