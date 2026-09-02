// Netlify Function (v2) — administração dos usuários (links de acesso).
// Protegida por ADMIN_TOKEN (env var) — única barreira desde que a senha do
// site inteiro (Basic Auth) foi desativada, ver netlify/edge-functions/gate.js.
// Existe para o bootstrap manual via curl (ex.: promover o primeiro admin) —
// o dia a dia de cadastrar/gerenciar usuários fica na aba "Usuários" da
// própria interface, servida por usuarios.mjs e restrita a quem já está
// logado como administrador.
//
// GET  -> lista os usuários cadastrados
// POST { acao: "criar", nome, admin? }       -> cria um usuário novo, devolve o link
// POST { acao: "revogar", codigo }          -> revoga um código (dados continuam intactos)
// POST { acao: "regenerar", codigo }        -> troca o código de alguém, mantendo os mesmos dados
// POST { acao: "renomear", codigo, novoNome } -> troca o nome de usuário de alguém
// POST { acao: "definir-admin", codigo, admin } -> promove/rebaixa alguém a administrador
//
// Uso (via curl, com o token de admin):
//   curl -H "x-admin-token: $ADMIN_TOKEN" \
//     -X POST https://SEUSITE/.netlify/functions/admin -d '{"acao":"criar","nome":"Maria","admin":true}'

import { getStore } from "@netlify/blobs";
import {
  autenticadoAdmin, listarUsuarios, buscarUsuarioPorCodigo, gravarUsuario, vincularLogin,
  criarUsuario, revogarUsuario, regenerarUsuario, renomearUsuario, definirAdmin,
  STORE_NOME, chave, ErroAcesso,
} from "./lib/usuarios.mjs";

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

    try {
      if (acao === "criar") {
        const resultado = await criarUsuario(body.nome, { admin: !!body.admin });
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

      if (acao === "definir-admin") {
        const resultado = await definirAdmin(String(body.codigo || ""), !!body.admin);
        return json({ ok: true, ...resultado });
      }
    } catch (err) {
      if (err instanceof ErroAcesso) return json({ error: err.message }, err.status);
      throw err;
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

    if (acao === "comprovantes-orfaos") {
      // Diagnóstico temporário, só leitura: lista comprovantes que ainda
      // estão guardados nos Blobs mesmo sem aparecer na tabela de despesas
      // — útil quando a tabela foi zerada (ex.: fluxo de "baixar solicitação")
      // mas os arquivos originais (comprovante) não foram apagados junto.
      const codigo = String(body.codigo || "");
      const registro = await buscarUsuarioPorCodigo(codigo);
      if (!registro) return json({ error: "Código não encontrado." }, 404);
      const store = getStore(STORE_NOME);
      const prefixo = chave(registro.userId, "file-meta:");
      const { blobs } = await store.list({ prefix: prefixo });
      const arquivos = [];
      for (const { key } of blobs) {
        const meta = await store.get(key, { type: "json" });
        arquivos.push({ id: key.slice(prefixo.length), fileName: meta && meta.fileName, mediaType: meta && meta.mediaType });
      }
      return json({ nome: registro.nome, total: arquivos.length, arquivos });
    }

    return json({ error: "Ação inválida. Use 'criar', 'revogar', 'regenerar', 'renomear', 'definir-admin', 'vincular-login' ou 'comprovantes-orfaos'." }, 400);
  }

  return json({ error: "Método não permitido" }, 405);
};
