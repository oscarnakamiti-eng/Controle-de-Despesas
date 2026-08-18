// Netlify Function (v2) — diagnóstico da configuração da ANTHROPIC_API_KEY.
// Acesse: /.netlify/functions/diag
// NUNCA mostra a chave — apenas características dela (tamanho, prefixo, espaços).

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export default async () => {
  const raw = process.env.ANTHROPIC_API_KEY;

  const diag = {
    variavelExiste: raw !== undefined && raw !== null,
    vazia: !raw,
    comprimento: raw ? raw.length : 0,
    prefixoCorreto: raw ? raw.startsWith("sk-ant-") : false,
    primeiros12: raw ? raw.slice(0, 12) : null,
    ultimos4: raw ? raw.slice(-4) : null,
    temEspacoOuQuebraDeLinha: raw ? /\s/.test(raw) : false,
    temAspas: raw ? /["']/.test(raw) : false,
  };

  if (!raw) {
    diag.diagnostico = "A variável ANTHROPIC_API_KEY não chegou à função. Confira o nome exato em Site settings → Environment variables e faça um novo deploy.";
    return json(diag);
  }

  if (diag.temEspacoOuQuebraDeLinha || diag.temAspas) {
    diag.diagnostico = "A chave contém espaço, quebra de linha ou aspas. Reedite a variável colando apenas o texto da chave.";
    return json(diag);
  }
  if (!diag.prefixoCorreto) {
    diag.diagnostico = "A chave não começa com 'sk-ant-'. Provavelmente foi colado o valor errado (ou está incompleta).";
    return json(diag);
  }

  // Teste real: chamada mínima à API
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": raw.trim(), "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 10, messages: [{ role: "user", content: "oi" }] }),
    });
    diag.statusDaChamada = res.status;
    const texto = await res.text();
    diag.respostaDaApi = texto.slice(0, 400);
    if (res.ok) {
      diag.diagnostico = "Chave válida e funcionando. Se o app ainda falhar, o deploy pode estar desatualizado — dispare um novo deploy.";
    } else if (res.status === 401) {
      diag.diagnostico = "A chave chegou íntegra à função, mas a Anthropic a rejeitou. Provavelmente foi revogada, é de outra organização, ou o workspace não tem créditos/billing. Gere uma nova chave em console.anthropic.com → API Keys.";
    } else if (res.status === 400 && texto.includes("model")) {
      diag.diagnostico = "A chave é válida, mas o modelo 'claude-sonnet-5' não está disponível para esta conta. Troque o valor de 'model' em extract.mjs.";
    } else {
      diag.diagnostico = `A API respondeu ${res.status}. Veja 'respostaDaApi' acima.`;
    }
  } catch (err) {
    diag.diagnostico = `Falha de rede ao contatar a API: ${String(err.message || err)}`;
  }

  return json(diag);
};
