// Netlify Function (v2) — TEMPORÁRIA. Copia os dados globais antigos (de antes
// do isolamento por usuário) para o namespace de um usuário específico.
// Nunca apaga nem sobrescreve: se a chave nova já existir, pula. Por isso é
// seguro rodar mais de uma vez.
//
// POST { userId, confirmar: true }  (protegido por ADMIN_TOKEN)
// Depois de confirmar que os dados migraram certinho, remova este arquivo.

import { getStore } from "@netlify/blobs";
import { autenticadoAdmin, chave } from "./lib/usuarios.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const CHAVES_SIMPLES = ["despesas.xlsx", "profile", "rateio-presets", "rascunho", "assinatura", "assinatura-meta"];
const PREFIXOS_LISTAVEIS = ["file:", "file-meta:", "preview:"];

async function copiarComVerificacao(store, chaveAntiga, chaveNova) {
  const bytes = await store.get(chaveAntiga, { type: "arrayBuffer" });
  if (!bytes) return { status: "inexistente" };
  const existente = await store.get(chaveNova, { type: "arrayBuffer" });
  if (existente) return { status: "pulado (já existe)" };
  for (let tentativa = 0; tentativa <= 2; tentativa++) {
    await store.set(chaveNova, bytes);
    const conferido = await store.get(chaveNova, { type: "arrayBuffer" });
    if (conferido && conferido.byteLength === bytes.byteLength) {
      return { status: "copiado", bytes: bytes.byteLength };
    }
  }
  return { status: "falha na verificação após gravar" };
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (!autenticadoAdmin(req)) return json({ error: "Não autorizado." }, 403);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
  const { userId, confirmar } = body || {};
  if (!userId || confirmar !== true) {
    return json({ error: "Envie { userId, confirmar: true } para rodar a migração." }, 400);
  }

  const store = getStore("expense-tracker", { consistency: "strong" });
  const resultado = {};

  for (const chaveAntiga of CHAVES_SIMPLES) {
    resultado[chaveAntiga] = await copiarComVerificacao(store, chaveAntiga, chave(userId, chaveAntiga));
  }

  for (const prefixo of PREFIXOS_LISTAVEIS) {
    const { blobs } = await store.list({ prefix: prefixo });
    for (const { key } of blobs) {
      resultado[key] = await copiarComVerificacao(store, key, chave(userId, key));
    }
  }

  return json({ ok: true, userId, resultado });
};
