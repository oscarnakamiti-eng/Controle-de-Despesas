// Netlify Function (v2) — administração dos usuários (links de acesso).
// Protegida por ADMIN_TOKEN (env var), separado da senha do site.
//
// GET  -> lista os usuários cadastrados
// POST { acao: "criar", nome }              -> cria um usuário novo, devolve o link
// POST { acao: "revogar", codigo }          -> revoga um código (dados continuam intactos)
// POST { acao: "regenerar", codigo }        -> troca o código de alguém, mantendo os mesmos dados
//
// Uso (via curl, com a senha do site + o token de admin):
//   curl -u "$SITE_USER:$SITE_PASSWORD" -H "x-admin-token: $ADMIN_TOKEN" \
//     -X POST https://SEUSITE/.netlify/functions/admin -d '{"acao":"criar","nome":"Maria"}'

import { autenticadoAdmin, listarUsuarios, buscarUsuarioPorCodigo, gravarUsuario, gerarCodigo, gerarUserId, buscarCodigoPorNome, vincularLogin } from "./lib/usuarios.mjs";

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
      if (body.diag) {
        const registroExistente = existente ? await buscarUsuarioPorCodigo(existente) : null;
        return json({ diag: true, existente, tipoExistente: typeof existente, registroExistente });
      }
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

    return json({ error: "Ação inválida. Use 'criar', 'revogar' ou 'regenerar'." }, 400);
  }

  return json({ error: "Método não permitido" }, 405);
};
