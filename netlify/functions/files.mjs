// Netlify Function (v2) — serve e apaga os arquivos dos comprovantes.
// GET    ?id=<id>&codigo=<codigo>            -> arquivo original (imagem ou PDF)
// GET    ?id=<id>&codigo=<codigo>&preview=N  -> página N do PDF convertida em JPEG
// DELETE ?id=<id>&codigo=<codigo>&pages=N    -> remove o original, os metadados e as N páginas convertidas

import { getStore } from "@netlify/blobs";
import { resolverUsuario, chave } from "./lib/usuarios.mjs";

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function chaveArquivo(userId, id) {
  return chave(userId, `file:${id}`);
}
export function chaveArquivoMeta(userId, id) {
  return chave(userId, `file-meta:${id}`);
}
export function chavePreview(userId, id, n) {
  return chave(userId, `preview:${id}:${n}`);
}

export default async (req) => {
  let userId;
  try { userId = await resolverUsuario(req); } catch (err) { return jsonRes({ error: err.message }, err.status || 403); }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonRes({ error: "Parâmetro id ausente" }, 400);

  const store = getStore("expense-tracker");
  const preview = url.searchParams.get("preview");

  if (req.method === "GET") {
    if (preview) {
      const buf = await store.get(chavePreview(userId, id, Number(preview) || 1), { type: "arrayBuffer" });
      if (!buf) return new Response("Página não encontrada", { status: 404 });
      return new Response(buf, {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
      });
    }
    const buffer = await store.get(chaveArquivo(userId, id), { type: "arrayBuffer" });
    if (!buffer) return new Response("Arquivo não encontrado", { status: 404 });
    const meta = (await store.get(chaveArquivoMeta(userId, id), { type: "json" })) || {};
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": meta.mediaType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (req.method === "DELETE") {
    await store.delete(chaveArquivo(userId, id));
    await store.delete(chaveArquivoMeta(userId, id));
    const pages = Number(url.searchParams.get("pages")) || 0;
    for (let n = 1; n <= pages; n++) await store.delete(chavePreview(userId, id, n));
    return jsonRes({ ok: true });
  }

  return jsonRes({ error: "Método não permitido" }, 405);
};
