// Netlify Function (v2) — diagnóstico temporário da configuração da
// ADMIN_TOKEN. NUNCA mostra o valor — só características (tamanho, espaços).
// Remover depois de confirmar que a variável está chegando certinho.

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export default async () => {
  const raw = process.env.ADMIN_TOKEN;
  const diag = {
    variavelExiste: raw !== undefined && raw !== null,
    vazia: !raw,
    comprimento: raw ? raw.length : 0,
    temEspacoOuQuebraDeLinha: raw ? /\s/.test(raw) : false,
    temAspas: raw ? /["']/.test(raw) : false,
    primeiros4: raw ? raw.slice(0, 4) : null,
    ultimos4: raw ? raw.slice(-4) : null,
  };
  return json(diag);
};
