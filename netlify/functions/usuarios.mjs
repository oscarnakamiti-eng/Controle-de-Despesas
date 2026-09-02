// Netlify Function (v2) — gestão de usuários pela própria interface (aba
// "Usuários"), restrita a quem está logado com registro.admin === true.
// Diferente de admin.mjs (protegido pelo ADMIN_TOKEN do servidor, usado só
// para o bootstrap do primeiro admin via curl), esta função nunca recebe nem
// expõe o ADMIN_TOKEN ao navegador — a autorização vem inteiramente do
// próprio login por código, checando a flag `admin` do cadastro de quem
// chamou. Só quem já detém o ADMIN_TOKEN pode ter promovido esse cadastro a
// admin em primeiro lugar (ver admin.mjs, ação "definir-admin"), então não dá
// pra alguém se auto-promover por aqui.
//
// GET  ?codigo=<codigo>                                       -> lista os usuários
// POST ?codigo=<codigo> { acao: "criar", nome }                -> cria um usuário, devolve o link
// POST ?codigo=<codigo> { acao: "revogar", codigo }            -> revoga o acesso de alguém
// POST ?codigo=<codigo> { acao: "regenerar", codigo }          -> troca o link de alguém
// POST ?codigo=<codigo> { acao: "renomear", codigo, novoNome } -> renomeia alguém

import {
  resolverRegistro, listarUsuarios, criarUsuario, revogarUsuario, regenerarUsuario, renomearUsuario, ErroAcesso,
} from "./lib/usuarios.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async (req) => {
  let registro;
  try { registro = await resolverRegistro(req); } catch (err) { return json({ error: err.message }, err.status || 403); }
  if (registro.admin !== true) {
    return json({ error: "Apenas administradores podem gerenciar usuários." }, 403);
  }

  if (req.method === "GET") {
    const usuarios = await listarUsuarios();
    return json({ usuarios });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const acao = body.acao;

    try {
      if (acao === "criar") {
        const resultado = await criarUsuario(body.nome);
        return json(resultado);
      }

      if (acao === "revogar") {
        await revogarUsuario(String(body.codigo || ""));
        return json({ ok: true });
      }

      if (acao === "regenerar") {
        const resultado = await regenerarUsuario(String(body.codigo || ""));
        return json(resultado);
      }

      if (acao === "renomear") {
        const resultado = await renomearUsuario(String(body.codigo || ""), body.novoNome);
        return json({ ok: true, ...resultado });
      }
    } catch (err) {
      if (err instanceof ErroAcesso) return json({ error: err.message }, err.status);
      throw err;
    }

    return json({ error: "Ação inválida. Use 'criar', 'revogar', 'regenerar' ou 'renomear'." }, 400);
  }

  return json({ error: "Método não permitido" }, 405);
};
