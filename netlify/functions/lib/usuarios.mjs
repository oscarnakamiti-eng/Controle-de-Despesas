// Base do isolamento por usuário: cada pessoa tem um link próprio
// (?u=<codigo>) que aponta pra um userId estável. Toda chave de dado no
// Netlify Blobs é prefixada com esse userId (veja chave()), então os dados
// de pessoas diferentes nunca se misturam.
//
// codigo: token público, vai na URL, pode ser revogado/trocado.
// userId: interno, nunca aparece na URL, nunca muda — é o que garante que
// regenerar o link de alguém não perde os dados dela.
//
// Cada usuário fica na SUA PRÓPRIA chave (_admin:usuario:<codigo>), não num
// índice único compartilhado — um índice único exigiria ler-modificar-escrever
// o objeto inteiro a cada criação/revogação, e o Netlify Blobs não tem
// compare-and-swap, então duas criações próximas no tempo podiam se
// sobrescrever (confirmado na prática: criar A e depois B fez B substituir A
// inteiro, porque a escrita de B partiu de uma leitura que ainda não via A).
// Com uma chave por usuário, criar/revogar uma pessoa nunca mexe na chave de
// outra.

import { getStore } from "@netlify/blobs";
import crypto from "crypto";

export const STORE_NOME = "expense-tracker";
const PREFIXO_USUARIO = "_admin:usuario:";

// Consistência forte: uma revogação ou um código recém-criado precisam
// valer imediatamente (mesmo motivo já usado em records.mjs/extract.mjs) —
// senão dá pra usar um código revogado por alguns segundos, ou um código
// novinho dá "não encontrado" por propagação atrasada.
function storeAdmin() {
  return getStore(STORE_NOME, { consistency: "strong" });
}

function chaveUsuario(codigo) {
  return `${PREFIXO_USUARIO}${codigo}`;
}

export async function buscarUsuarioPorCodigo(codigo) {
  return await storeAdmin().get(chaveUsuario(codigo), { type: "json" });
}

export async function gravarUsuario(codigo, registro) {
  await storeAdmin().setJSON(chaveUsuario(codigo), registro);
}

export async function listarUsuarios() {
  const store = storeAdmin();
  const { blobs } = await store.list({ prefix: PREFIXO_USUARIO });
  const usuarios = [];
  for (const { key } of blobs) {
    const registro = await store.get(key, { type: "json" });
    if (registro) usuarios.push({ codigo: key.slice(PREFIXO_USUARIO.length), ...registro });
  }
  return usuarios;
}

// Login por nome: em vez de compartilhar um link, a pessoa digita o próprio
// nome e recebe de volta o mesmo "codigo" que os links usavam — o resto do
// isolamento por usuário (chave por userId, revogação, etc.) continua
// idêntico, só muda como o código chega até o navegador da pessoa.
const PREFIXO_LOGIN = "_admin:login:";

export function normalizarNome(nome) {
  return String(nome || "").trim().toLowerCase();
}

function chaveLogin(nome) {
  return `${PREFIXO_LOGIN}${normalizarNome(nome)}`;
}

export async function buscarCodigoPorNome(nome) {
  if (!normalizarNome(nome)) return null;
  return await storeAdmin().get(chaveLogin(nome), { type: "text" });
}

export async function vincularLogin(nome, codigo) {
  await storeAdmin().set(chaveLogin(nome), codigo);
}

export async function removerLogin(nome) {
  await storeAdmin().delete(chaveLogin(nome));
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

export class ErroAcesso extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

// Regras de negócio do cadastro de usuários, compartilhadas por admin.mjs
// (protegido pelo ADMIN_TOKEN, usado via curl para o bootstrap) e por
// usuarios.mjs (auto-serviço na própria interface, restrito a quem já está
// logado com registro.admin === true). Nenhuma das duas rotas duplica esta
// lógica — só o jeito de autenticar quem está chamando é diferente.

export async function criarUsuario(nome, { admin = false } = {}) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) throw new ErroAcesso("Informe o nome da pessoa.", 400);
  const existente = await buscarCodigoPorNome(nomeLimpo);
  if (existente) {
    const registroExistente = await buscarUsuarioPorCodigo(existente);
    if (registroExistente && !registroExistente.revogado) {
      throw new ErroAcesso("Já existe uma pessoa ativa com esse nome de usuário.", 409);
    }
  }
  const codigo = gerarCodigo();
  const userId = gerarUserId();
  await gravarUsuario(codigo, { userId, nome: nomeLimpo, criadoEm: new Date().toISOString(), revogado: false, admin: !!admin });
  await vincularLogin(nomeLimpo, codigo);
  return { codigo, userId, link: `/?u=${codigo}` };
}

export async function revogarUsuario(codigo) {
  const registro = await buscarUsuarioPorCodigo(codigo);
  if (!registro) throw new ErroAcesso("Código não encontrado.", 404);
  registro.revogado = true;
  await gravarUsuario(codigo, registro);
}

export async function regenerarUsuario(codigoAntigo) {
  const registro = await buscarUsuarioPorCodigo(codigoAntigo);
  if (!registro) throw new ErroAcesso("Código não encontrado.", 404);
  registro.revogado = true;
  await gravarUsuario(codigoAntigo, registro);
  const novoCodigo = gerarCodigo();
  await gravarUsuario(novoCodigo, { userId: registro.userId, nome: registro.nome, criadoEm: registro.criadoEm, revogado: false, admin: registro.admin === true });
  await vincularLogin(registro.nome, novoCodigo);
  return { codigo: novoCodigo, userId: registro.userId, link: `/?u=${novoCodigo}` };
}

export async function renomearUsuario(codigo, novoNome) {
  const nomeLimpo = String(novoNome || "").trim();
  if (!nomeLimpo) throw new ErroAcesso("Informe o novo nome de usuário.", 400);
  const registro = await buscarUsuarioPorCodigo(codigo);
  if (!registro) throw new ErroAcesso("Código não encontrado.", 404);
  const existente = await buscarCodigoPorNome(nomeLimpo);
  if (existente && existente !== codigo) {
    const registroExistente = await buscarUsuarioPorCodigo(existente);
    if (registroExistente && !registroExistente.revogado) {
      throw new ErroAcesso("Já existe uma pessoa ativa com esse nome de usuário.", 409);
    }
  }
  const nomeAntigo = registro.nome;
  registro.nome = nomeLimpo;
  await gravarUsuario(codigo, registro);
  await vincularLogin(nomeLimpo, codigo);
  if (normalizarNome(nomeAntigo) !== normalizarNome(nomeLimpo)) {
    await removerLogin(nomeAntigo);
  }
  return { nome: nomeLimpo };
}

export async function definirAdmin(codigo, admin) {
  const registro = await buscarUsuarioPorCodigo(codigo);
  if (!registro) throw new ErroAcesso("Código não encontrado.", 404);
  registro.admin = !!admin;
  await gravarUsuario(codigo, registro);
  return { nome: registro.nome, admin: registro.admin };
}

// Lê ?codigo= da URL da requisição e resolve o cadastro correspondente.
// Lança erro (com .status) se o código estiver ausente, inválido ou revogado
// — nunca cai em nenhum dado "padrão" por omissão.
export async function resolverRegistro(req) {
  const codigo = new URL(req.url).searchParams.get("codigo");
  if (!codigo) {
    throw new ErroAcesso("Acesso ausente. Entre com seu nome de usuário.", 401);
  }
  const registro = await buscarUsuarioPorCodigo(codigo);
  if (!registro || registro.revogado) {
    throw new ErroAcesso("Acesso inválido ou desativado. Fale com o administrador.", 403);
  }
  return registro;
}

// Atalho para quem só precisa saber de quem são os dados (a maioria das
// funções) — o userId é o prefixo de toda chave no Blobs.
export async function resolverUsuario(req) {
  return (await resolverRegistro(req)).userId;
}

// Autenticação própria do admin, independente do login por nome — quem sabe
// o nome de alguém não deve conseguir se auto-promover a administrador.
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
