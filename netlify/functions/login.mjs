// Netlify Function (v2) — login por nome de usuário (sem senha; saber o
// próprio nome cadastrado já é a barreira de entrada — ver justificativa em
// netlify/edge-functions/gate.js). Em vez de cada
// pessoa receber um link com um código na URL, ela digita o próprio nome
// aqui e recebe de volta esse mesmo código, que o navegador guarda como
// sempre guardou — o isolamento por usuário nas outras funções não muda em
// nada, só a forma de obter o código é que deixa de ser um link para
// distribuir.
//
// POST { nome } -> { codigo }

import { buscarCodigoPorNome, buscarUsuarioPorCodigo } from "./lib/usuarios.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
  const nome = String(body.nome || "").trim();
  if (!nome) return json({ error: "Informe seu nome de usuário." }, 400);

  const codigo = await buscarCodigoPorNome(nome);
  if (!codigo) return json({ error: "Usuário não encontrado. Peça para o administrador te cadastrar." }, 404);

  const registro = await buscarUsuarioPorCodigo(codigo);
  if (!registro || registro.revogado) {
    return json({ error: "Acesso desativado para este usuário. Fale com o administrador." }, 403);
  }

  return json({ codigo });
};
