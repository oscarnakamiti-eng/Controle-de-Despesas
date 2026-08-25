// Netlify Function (v2) — chama a API da Anthropic server-side (chave secreta em
// ANTHROPIC_API_KEY) para extrair os dados do comprovante e, em caso de sucesso,
// guarda o arquivo original (imagem/PDF) no Netlify Blobs para uso posterior
// (preview, relatório fotográfico, reimpressão), mesmo depois de recarregar a página.

import { getStore } from "@netlify/blobs";
import { resolverUsuario } from "./lib/usuarios.mjs";
import { chaveArquivo, chaveArquivoMeta } from "./files.mjs";

const EXTRACTION_PROMPT = `Analise o comprovante, recibo, nota fiscal ou cupom fiscal anexado e extraia as informações do gasto.

Responda APENAS com um objeto JSON puro, sem markdown, sem texto antes ou depois, no formato exato:
{"data": "DD/MM/AAAA", "tipo": "Almoço" | "Jantar" | "Combustível" | "Hospedagem" | "Materiais e Serviços", "valor": 0.00, "observacoes": "texto curto"}

Regras:
- "tipo" deve ser exatamente um dos cinco valores acima.
- Para Almoço ou Jantar: se houver horário no comprovante, até 16:00 é Almoço e após 16:00 é Jantar. Sem horário visível, use o contexto (nome do estabelecimento, itens consumidos).
- Para "Materiais e Serviços", a "observacoes" deve descrever brevemente o que foi comprado ou contratado.
- "valor" é o valor TOTAL pago, como número decimal usando ponto (ex.: 1234.56), sem separador de milhares.
- "data" é a data da compra/consumo (não a data de emissão do relatório).
- Se algum campo não puder ser identificado com certeza, use null nesse campo.
- Não escreva nada além do JSON.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Grava no Blob e confirma lendo de volta antes de devolver sucesso. Já
// aconteceu de store.set() não lançar erro mesmo assim o arquivo não ficar
// salvo de verdade (comprovante "perdido" em envios em lote) — em vez de só
// confiar que não deu erro, confere o tamanho gravado e tenta de novo antes
// de desistir.
async function gravarComConfirmacao(store, key, bytes, tentativas = 2) {
  for (let i = 0; i <= tentativas; i++) {
    await store.set(key, bytes);
    const conferido = await store.get(key, { type: "arrayBuffer" });
    if (conferido && conferido.byteLength === bytes.byteLength) return;
  }
  throw new Error("Não foi possível confirmar a gravação do arquivo nos Blobs após múltiplas tentativas.");
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let userId;
  try { userId = await resolverUsuario(req); } catch (err) { return json({ error: err.message }, err.status || 403); }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }

  const { id, base64, mediaType, isPdf, fileName } = payload || {};
  if (!base64) return json({ error: "Arquivo (base64) ausente" }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do site na Netlify." }, 500);
  }

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } };

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: EXTRACTION_PROMPT }] }],
      }),
    });
  } catch (err) {
    return json({ error: `Falha ao contatar a API da Anthropic: ${String(err.message || err)}` }, 502);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    return json({ error: `Erro da API Anthropic (${anthropicRes.status}): ${errText}` }, 502);
  }

  const data = await anthropicRes.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) return json({ error: "Resposta vazia do modelo" }, 502);

  let clean = textBlock.text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  let parsed;
  try { parsed = JSON.parse(clean); } catch { return json({ error: "Não foi possível interpretar a resposta do modelo como JSON" }, 502); }

  // Guarda o arquivo original nos Blobs para uso posterior (preview / relatório fotográfico)
  if (id) {
    try {
      const store = getStore("expense-tracker", { consistency: "strong" });
      const bytes = Buffer.from(base64, "base64");
      await gravarComConfirmacao(store, chaveArquivo(userId, id), bytes);
      await store.setJSON(chaveArquivoMeta(userId, id), { mediaType: isPdf ? "application/pdf" : (mediaType || "image/jpeg"), fileName: fileName || null });
    } catch (err) {
      // não falha a extração por causa disso — só avisa
      return json({ parsed, fileStored: false, fileError: String(err.message || err) });
    }
  }

  return json({ parsed, fileStored: !!id });
};
