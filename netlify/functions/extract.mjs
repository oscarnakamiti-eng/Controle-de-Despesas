// Netlify Function (v2) — recebe {base64, mediaType, isPdf} e chama a API da Anthropic
// server-side, usando a chave secreta guardada em ANTHROPIC_API_KEY (variável de ambiente
// do site na Netlify). A chave NUNCA fica exposta no navegador.

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo da requisição inválido" }, 400);
  }

  const { base64, mediaType, isPdf } = payload || {};
  if (!base64) {
    return json({ error: "Arquivo (base64) ausente" }, 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do site na Netlify." },
      500
    );
  }

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } };

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [
          { role: "user", content: [contentBlock, { type: "text", text: EXTRACTION_PROMPT }] },
        ],
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
  if (!textBlock) {
    return json({ error: "Resposta vazia do modelo" }, 502);
  }

  let clean = textBlock.text.trim();
  clean = clean.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return json({ error: "Não foi possível interpretar a resposta do modelo como JSON" }, 502);
  }

  return json({ parsed });
};
