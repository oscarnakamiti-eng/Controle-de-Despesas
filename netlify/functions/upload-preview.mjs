// Netlify Function (v2) — recebe as páginas de um PDF já convertidas em PNG pelo
// navegador (pdf.js) e as guarda nos Blobs, para que a pré-visualização e o
// relatório fotográfico consigam exibir e imprimir comprovantes em PDF.
// POST { id, page, base64 }

import { getStore } from "@netlify/blobs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }

  const { id, page, base64 } = body || {};
  if (!id || !base64) return json({ error: "Parâmetros id e base64 são obrigatórios" }, 400);

  const n = Number(page) || 1;
  try {
    const store = getStore("expense-tracker");
    await store.set(`preview:${id}:${n}`, Buffer.from(base64, "base64"));
    return json({ ok: true, page: n });
  } catch (err) {
    return json({ error: `Falha ao guardar a página: ${String(err.message || err)}` }, 500);
  }
};
