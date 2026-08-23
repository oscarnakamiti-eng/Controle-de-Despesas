// Protege o site inteiro (páginas e funções) com usuário/senha via HTTP Basic Auth.
// Configurável em Site settings -> Environment variables: SITE_USER e SITE_PASSWORD.
// Sem SITE_PASSWORD configurada, o site fica aberto (nenhum bloqueio é aplicado).

export default async (req, context) => {
  const user = Netlify.env.get("SITE_USER") || "";
  const pass = Netlify.env.get("SITE_PASSWORD") || "";
  if (!pass) return context.next();

  const auth = req.headers.get("authorization") || "";
  const esperado = "Basic " + btoa(`${user}:${pass}`);
  if (auth === esperado) return context.next();

  return new Response("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Despesas de Viagem"' },
  });
};

export const config = { path: "/*" };
