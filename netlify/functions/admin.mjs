// Netlify Function (v2) — administração dos usuários (links de acesso).
// Protegida por ADMIN_TOKEN (env var) — única barreira desde que a senha do
// site inteiro (Basic Auth) foi desativada, ver netlify/edge-functions/gate.js.
//
// GET  -> lista os usuários cadastrados
// POST { acao: "criar", nome }              -> cria um usuário novo, devolve o link
// POST { acao: "revogar", codigo }          -> revoga um código (dados continuam intactos)
// POST { acao: "regenerar", codigo }        -> troca o código de alguém, mantendo os mesmos dados
//
// Uso (via curl, com o token de admin):
//   curl -H "x-admin-token: $ADMIN_TOKEN" \
//     -X POST https://SEUSITE/.netlify/functions/admin -d '{"acao":"criar","nome":"Maria"}'

import { autenticadoAdmin, listarUsuarios, buscarUsuarioPorCodigo, gravarUsuario, gerarCodigo, gerarUserId, buscarCodigoPorNome, vincularLogin, removerLogin, normalizarNome } from "./lib/usuarios.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  if (!autenticadoAdmin(req)) {
    return json({ error: "Não autorizado." }, 403);
  }

  if (req.method === "GET") {
    const usuarios = await listarUsuarios();
    return json({ usuarios });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const acao = body.acao;

    if (acao === "criar") {
      const nome = String(body.nome || "").trim();
      if (!nome) return json({ error: "Informe o nome da pessoa." }, 400);
      const existente = await buscarCodigoPorNome(nome);
      if (existente) {
        const registroExistente = await buscarUsuarioPorCodigo(existente);
        if (registroExistente && !registroExistente.revogado) {
          return json({ error: "Já existe uma pessoa ativa com esse nome de usuário." }, 409);
        }
      }
      const codigo = gerarCodigo();
      const userId = gerarUserId();
      await gravarUsuario(codigo, { userId, nome, criadoEm: new Date().toISOString(), revogado: false });
      await vincularLogin(nome, codigo);
      return json({ codigo, userId, link: `/?u=${codigo}` });
    }

    if (acao === "revogar") {
      const codigo = String(body.codigo || "");
      const registro = await buscarUsuarioPorCodigo(codigo);
      if (!registro) return json({ error: "Código não encontrado." }, 404);
      registro.revogado = true;
      await gravarUsuario(codigo, registro);
      return json({ ok: true });
    }

    if (acao === "regenerar") {
      const codigoAntigo = String(body.codigo || "");
      const registro = await buscarUsuarioPorCodigo(codigoAntigo);
      if (!registro) return json({ error: "Código não encontrado." }, 404);
      registro.revogado = true;
      await gravarUsuario(codigoAntigo, registro);
      const novoCodigo = gerarCodigo();
      await gravarUsuario(novoCodigo, { userId: registro.userId, nome: registro.nome, criadoEm: registro.criadoEm, revogado: false });
      await vincularLogin(registro.nome, novoCodigo);
      return json({ codigo: novoCodigo, userId: registro.userId, link: `/?u=${novoCodigo}` });
    }

    if (acao === "renomear") {
      const codigo = String(body.codigo || "");
      const novoNome = String(body.novoNome || "").trim();
      if (!novoNome) return json({ error: "Informe o novo nome de usuário." }, 400);
      const registro = await buscarUsuarioPorCodigo(codigo);
      if (!registro) return json({ error: "Código não encontrado." }, 404);
      const existente = await buscarCodigoPorNome(novoNome);
      if (existente && existente !== codigo) {
        const registroExistente = await buscarUsuarioPorCodigo(existente);
        if (registroExistente && !registroExistente.revogado) {
          return json({ error: "Já existe uma pessoa ativa com esse nome de usuário." }, 409);
        }
      }
      const nomeAntigo = registro.nome;
      registro.nome = novoNome;
      await gravarUsuario(codigo, registro);
      await vincularLogin(novoNome, codigo);
      if (normalizarNome(nomeAntigo) !== normalizarNome(novoNome)) {
        await removerLogin(nomeAntigo);
      }
      return json({ ok: true, nome: novoNome });
    }

    if (acao === "vincular-login") {
      // Backfill não-destrutivo: liga o nome de alguém já cadastrado (antes
      // de existir login por nome) ao código que já tem, sem revogar nada
      // nem afetar sessões já salvas no navegador da pessoa.
      const codigo = String(body.codigo || "");
      const registro = await buscarUsuarioPorCodigo(codigo);
      if (!registro) return json({ error: "Código não encontrado." }, 404);
      await vincularLogin(registro.nome, codigo);
      return json({ ok: true, nome: registro.nome });
    }

    return json({ error: "Ação inválida. Use 'criar', 'revogar', 'regenerar', 'renomear' ou 'vincular-login'." }, 400);
  }

  return json({ error: "Método não permitido" }, 405);
};
