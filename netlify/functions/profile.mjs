// Netlify Function (v2) — guarda os dados fixos do solicitante (nome, cargo, conta
// bancária etc.) e da empresa/departamento, para preencher automaticamente as
// planilhas oficiais sem precisar redigitar a cada solicitação.
// GET  -> devolve { profile: {...} }
// POST -> recebe { profile: {...} } e substitui o conteúdo salvo

import { getStore } from "@netlify/blobs";

const KEY = "profile";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const profile = (await store.get(KEY, { type: "json" })) || {};
    return json({ profile });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
    await store.setJSON(KEY, profile);
    return json({ ok: true });
  }

  return json({ error: "Método não permitido" }, 405);
};
