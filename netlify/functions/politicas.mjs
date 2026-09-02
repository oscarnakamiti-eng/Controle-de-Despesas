// Netlify Function (v2) — política de limite por tipo de despesa (ex.: teto
// de Almoço/Jantar). Diferente de profile.mjs (dados por usuário: nome,
// cargo, banco...), aqui existe UMA ÚNICA configuração, compartilhada por
// todos — o teto de reembolso é uma regra da empresa, não uma preferência
// individual. Qualquer usuário logado pode ler (precisa saber o próprio
// limite na hora de lançar uma despesa); só quem está com registro.admin
// === true pode alterar.
//
// GET  ?codigo=<codigo>                    -> devolve { politicas: {...} }
// POST ?codigo=<codigo> { politicas }       -> (só admin) substitui a configuração salva

import { getStore } from "@netlify/blobs";
import { resolverRegistro } from "./lib/usuarios.mjs";

const KEY = "_config:politicas";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  let registro;
  try { registro = await resolverRegistro(req); } catch (err) { return json({ error: err.message }, err.status || 403); }
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const politicas = (await store.get(KEY, { type: "json" })) || {};
    return json({ politicas });
  }

  if (req.method === "POST") {
    if (registro.admin !== true) {
      return json({ error: "Apenas administradores podem alterar as políticas." }, 403);
    }
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const politicas = body.politicas && typeof body.politicas === "object" ? body.politicas : {};
    await store.setJSON(KEY, politicas);
    return json({ ok: true });
  }

  return json({ error: "Método não permitido" }, 405);
};
