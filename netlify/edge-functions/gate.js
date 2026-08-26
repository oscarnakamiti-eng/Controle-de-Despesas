// Desativado: o site inteiro exigia usuário/senha via HTTP Basic Auth antes
// de existir login por nome. Foi desligado porque a senha compartilhada
// quebrava silenciosamente em alguns navegadores/webviews de celular — o
// app fazia uma chamada em segundo plano (POST para /login) sem reenviar a
// credencial cacheada, e a pessoa via "Autenticação necessária" (401) na
// hora de entrar com o nome dela. A proteção real agora é: cada pessoa
// precisa saber o próprio nome de usuário cadastrado (login.mjs), e as
// ações de administração exigem ADMIN_TOKEN à parte (lib/usuarios.mjs).
//
// Não removido do repositório para manter o histórico de por que existiu;
// se um dia fizer sentido reativar, o código antigo está no git log.

export default async (req, context) => {
  return context.next();
};

export const config = { path: "/__nunca-bate-em-nada__" };
