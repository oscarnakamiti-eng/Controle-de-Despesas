// Netlify Function (v2) — guarda os dados fixos do solicitante (nome, cargo, conta
// bancária etc.) e da empresa/departamento, para preencher automaticamente as
// planilhas oficiais sem precisar redigitar a cada solicitação.
// GET  -> devolve { profile: {...} }
// POST -> recebe { profile: {...} } e substitui o conteúdo salvo

import { getStore } from "@netlify/blobs";
import { resolverRegistro, chave } from "./lib/usuarios.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  let registro;
  try { registro = await resolverRegistro(req); } catch (err) { return json({ error: err.message }, err.status || 403); }
  const userId = registro.userId;
  const KEY = chave(userId, "profile");
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    const profile = (await store.get(KEY, { type: "json" })) || {};
    // Devolve também o nome de login, pro app mostrar quem está conectado
    // (funciona pra quem entrou pelo login e pra quem já tinha o acesso salvo).
    return json({ profile, usuario: registro.nome || "" });
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
