// Server-side messages (Worker API and the local setup server), same scheme as public/js/i18n.js:
// Portuguese source text is the key; English lives here. The app sends X-Estudar-Lang.
const EN = {
  // API
  'Não encontrado.': 'Not found.',
  'Erro inesperado.': 'Unexpected error.',
  'A correr neste computador': 'Running on this computer',
  'A correr no Cloudflare': 'Running on Cloudflare',
  'Máximo {n} planos por utilizador por dia': 'Up to {n} plans per user per day',
  'Sem chave secreta do Supabase: gerações ilimitadas': 'No Supabase secret key: unlimited generations',
  'Não configurado': 'Not configured',
  'Online': 'Online',
  'Chave pública (anon/publishable) inválida': 'Invalid public (anon/publishable) key',
  'Respondeu {n}': 'Responded {n}',
  'Não foi possível contactar o URL do projeto': 'Couldn\'t reach the project URL',
  'Tabelas criadas': 'Tables created',
  'Tabelas ainda não criadas': 'Tables not created yet',
  'Sem resposta': 'No response',
  'Sem chave de IA': 'No AI key',
  'Define o modelo': 'Set the model',
  'Modelo {m} não existe': 'Model {m} doesn\'t exist',
  'Chave inválida ou sem acesso': 'Invalid key or no access',
  'Chave inválida': 'Invalid key',
  'Fornecedor desconhecido': 'Unknown provider',
  'Sem resposta do fornecedor': 'No response from the provider',
  'Pedido inválido.': 'Invalid request.',
  'Indica uma data de início anterior à data dos exames.': 'Enter a start date before the exam date.',
  'Indica as horas disponíveis de cada dia.': 'Enter the available hours for each day.',
  'Adiciona pelo menos uma disciplina.': 'Add at least one subject.',
  'A IA ainda não está configurada no servidor.': 'The AI isn\'t configured on the server yet.',
  'Define o modelo de IA na configuração do servidor.': 'Set the AI model in the server configuration.',
  'Gemini não devolveu resposta.': 'Gemini returned no response.',
  'O modelo recusou o pedido.': 'The model declined the request.',
  'A resposta ficou incompleta.': 'The response was incomplete.',
  'A IA não devolveu resposta.': 'The AI returned no response.',
  'Não foi possível ler o limite de uso (a chave secreta do Supabase está correta?).': 'Couldn\'t read the usage limit (is the Supabase secret key correct?).',
  'Sessão inválida. Volta a entrar.': 'Invalid session. Please sign in again.',
  'Atingiste o limite de {n} pedidos à IA hoje. Tenta amanhã.': 'You\'ve reached today\'s limit of {n} AI requests. Try again tomorrow.',
  'A IA falhou.': 'The AI failed.',
  'Envia uma imagem JPEG, PNG ou WebP.': 'Send a JPEG, PNG or WebP image.',
  'A imagem é demasiado grande (máx. 5 MB).': 'The image is too large (max. 5 MB).',

  // Local setup server
  'Pedido recusado.': 'Request refused.',
  'O token deve começar por sbp_.': 'The token must start with sbp_.',
  '{k} não pode ter quebras de linha.': '{k} can\'t contain line breaks.',
  'Wrangler não está instalado. Corre "npm install" nesta pasta.': 'Wrangler isn\'t installed. Run "npm install" in this folder.',
  'Conta Cloudflare não ligada': 'Cloudflare account not connected',
  'Ligado como {email}': 'Connected as {email}',
  'Conta ligada': 'Account connected',
  'Ainda não publicado': 'Not published yet',
  'Sem resposta do endereço publicado': 'No response from the published address',
  'Falta configurar o Supabase antes de publicar.': 'Set up Supabase before publishing.',
  '▶ A publicar a app no Cloudflare…': '▶ Publishing the app to Cloudflare…',
  '→ A tua conta ainda não tem um subdomínio workers.dev. Abre dash.cloudflare.com → Workers & Pages, escolhe um nome e tenta de novo.': '→ Your account doesn\'t have a workers.dev subdomain yet. Open dash.cloudflare.com → Workers & Pages, pick a name and try again.',
  '▶ A enviar as chaves como segredos do Worker…': '▶ Sending the keys as Worker secrets…',
  '▶ A autorizar o novo endereço no Supabase…': '▶ Authorising the new address in Supabase…',
  '✓ Publicado': '✓ Published',
  'O URL do Supabase não parece válido (https://<ref>.supabase.co).': 'The Supabase URL doesn\'t look valid (https://<ref>.supabase.co).',
  'Não foi possível ler a configuração de autenticação ({n}).': 'Couldn\'t read the auth configuration ({n}).',
  'Endereços autorizados e email com código configurado.': 'Addresses authorised and code email set up.',
  'A configuração de autenticação falhou ({n}). Faz este passo à mão (ver README).': 'The auth configuration failed ({n}). Do this step by hand (see the README).',
  'Guarda primeiro o URL do projeto Supabase.': 'Save the Supabase project URL first.',
  'Tabelas e regras de acesso criadas.': 'Tables and access rules created.',
  'Token inválido.': 'Invalid token.',
  'Não foi possível criar as tabelas ({n}). Usa “Copiar SQL”.': 'Couldn\'t create the tables ({n}). Use “Copy SQL”.',
  'Chaves do projeto preenchidas automaticamente.': 'Project keys filled in automatically.',
};

export const langFrom = (value) => (String(value || '').toLowerCase().startsWith('en') ? 'en' : 'pt');

export function tr(lang, key, vars) {
  let s = lang === 'en' ? (EN[key] ?? key) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

export const SERVER_EN = EN;
