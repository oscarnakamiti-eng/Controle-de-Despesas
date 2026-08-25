// Base do isolamento por usuário: cada pessoa tem um link próprio
// (?u=<codigo>) que aponta pra um userId estável. Toda chave de dado no
// Netlify Blobs é prefixada com esse userId (veja chave()), então os dados
// de pessoas diferentes nunca se misturam.
//
// codigo: token público, vai na URL, pode ser revogado/trocado.
// userId: interno, nunca aparece na URL, nunca muda — é o que garante que
// regenerar o link de alguém não perde os dados dela.

import { getStore } from "@netlify/blobs";
import crypto from "crypto";

export const STORE_NOME = "expense-tracker";
const INDICE_KEY = "_admin:usuarios";

// Consistência forte: uma revogação ou um código recém-criado precisam
// valer imediatamente (mesmo motivo já usado em records.mjs/extract.mjs) —
// senão dá pra usar um código revogado por alguns segundos, ou um código
// novinho dá "não encontrado" por propagação atrasada.
function storeIndice() {
  return getStore(STORE_NOME, { consistency: "strong" });
}

export async function lerIndice() {
  return (await storeIndice().get(INDICE_KEY, { type: "json" })) || {};
}

export async function gravarIndice(indice) {
  await storeIndice().setJSON(INDICE_KEY, indice);
}

export function gerarCodigo() {
  return crypto.randomBytes(18).toString("base64url");
}

export function gerarUserId() {
  return crypto.randomBytes(6).toString("hex");
}

export function chave(userId, sufixo) {
  return `u:${userId}:${sufixo}`;
}

class ErroAcesso extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

// Lê ?codigo= da URL da requisição e resolve o userId correspondente.
// Lança erro (com .status) se o código estiver ausente, inválido ou revogado
// — nunca cai em nenhum dado "padrão" por omissão.
export async function resolverUsuario(req) {
  const codigo = new URL(req.url).searchParams.get("codigo");
  if (!codigo) {
    throw new ErroAcesso("Link de acesso ausente. Peça um novo link ao administrador.", 401);
  }
  const indice = await lerIndice();
  const registro = indice[codigo];
  if (!registro || registro.revogado) {
    throw new ErroAcesso("Link de acesso inválido ou revogado. Peça um novo link ao administrador.", 403);
  }
  return registro.userId;
}

// Autenticação separada da senha do site (SITE_USER/SITE_PASSWORD) — quem
// tem a senha do site não deve conseguir se auto-promover a administrador.
// Sem ADMIN_TOKEN configurado, o endpoint de admin fica bloqueado (fail-closed).
export function autenticadoAdmin(req) {
  const tokenEsperado = process.env.ADMIN_TOKEN || "";
  if (!tokenEsperado) return false;
  const url = new URL(req.url);
  const enviado = String(req.headers.get("x-admin-token") || url.searchParams.get("token") || "");
  const bufEnviado = Buffer.from(enviado);
  const bufEsperado = Buffer.from(tokenEsperado);
  if (bufEnviado.length !== bufEsperado.length) return false;
  return crypto.timingSafeEqual(bufEnviado, bufEsperado);
}
