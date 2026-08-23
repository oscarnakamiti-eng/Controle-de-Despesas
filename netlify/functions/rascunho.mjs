// Netlify Function (v2) — guarda o formulário de geração em preenchimento
// (motivo, valor do adiantamento, rateio, previsões) que ainda não foi
// gerado, para não se perder se a página fechar antes disso. Não há
// histórico de relatórios já gerados — a empresa já controla isso em
// outra ferramenta.
// GET  -> devolve { rascunho: {...} }
// POST -> recebe { rascunho: {...} } e substitui o conteúdo salvo

import { getStore } from "@netlify/blobs";

const KEY = "rascunho";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const rascunho = (await store.get(KEY, { type: "json" })) || {};
    return json({ rascunho });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const rascunho = body.rascunho && typeof body.rascunho === "object" ? body.rascunho : {};
    await store.setJSON(KEY, rascunho);
    return json({ ok: true });
  }

  return json({ error: "Método não permitido" }, 405);
};
