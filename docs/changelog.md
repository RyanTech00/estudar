# Changelog

## v1.2.0 — atualização de segurança

Auditoria de segurança completa (OWASP) e **dono e leitores**. Depois de atualizar (`npx estudar@latest`), abre o link do terminal e carrega uma vez em **Configurar** (com o teu email) e em **Publicar**: aplica as migrações novas, fecha os registos e envia os cabeçalhos de segurança para o Worker.

- **Dono e leitores.** O **Configurar** pede o teu email: ficas **dono** (só tu usas a IA e vês a configuração) e os registos no Supabase fecham. Em **Quem pode entrar** juntas **leitores**, que veem o teu plano e o teu progresso em modo só leitura, e removes o acesso com um botão. A base de dados (tabela `viewers`, só leitura para os clientes) e o Worker garantem isto; o ecrã só o reflete. Novo ponto **Registos** no painel de estado.
- **Auditoria de segurança (OWASP)** e correções: *Content-Security-Policy* estrita e cabeçalhos de segurança em todas as respostas (incluindo os ficheiros estáticos); cliente do Supabase incluído na app numa versão fixa, sem CDN; filtro único para todos os dados que chegam de fora e escape de todos os campos (XSS); login com PKCE; o acesso dos leitores fica ligado à conta, não ao email; limite de IA atómico e só para o dono; `/api/health` fechado ao público; ecrã de configuração com chave por arranque, proteção contra *DNS rebinding* e limites de tamanho; *grants* mínimos e limite de 2 MB por documento na base de dados; GitHub Actions fixadas, Dependabot, publicação sem scripts de instalação; site da documentação com fontes locais e cabeçalhos de segurança. Ver [Privacidade e segurança](/guia/seguranca#protecoes-tecnicas) e `SECURITY.md`.
- **Login com Google marcado como "Em breve"**: o botão aparece a cinzento, sem se poder clicar, até estar pronto.
- **Chaves no campo errado são recusadas**: a secreta no campo público (seria enviada aos browsers) ou a pública no campo da secreta. Se já estiverem trocadas, o painel mostra-o e o **Configurar** corrige.
- **Email de login em projetos Supabase novos**: desde junho de 2026, o email incluído no Supabase não deixa mudar o modelo. Os endereços autorizados passam a ser gravados à parte (o link já não vai para `localhost:3000`) e a app explica que é preciso um SMTP próprio.
- Mensagens de login mais claras para os limites do Supabase (2 emails por hora com o email incluído; intervalo entre códigos).
- Instruções do Supabase atualizadas para o painel atual (botão **Copy** do projeto).

## v1.1.0 — no npm, em inglês e com cópia de segurança

- **Instalação com um comando**: `npx estudar` descarrega e arranca a app e o ecrã Servidor e chaves, sem clonar o repositório. As chaves ficam em `~/.estudar` (ou na pasta indicada em `ESTUDAR_HOME`). Opções `--port`, `--no-open`, `--help` e `--version`.
- **A app em português e inglês**: todo o texto da interface, as mensagens do servidor e os planos gerados pela IA seguem o idioma escolhido em **Conta → Idioma**, detetado automaticamente pelo browser.
- **Documentação bilingue** (português e inglês), com capturas de ecrã nas duas línguas.
- Ligação de apoio **Buy Me a Coffee** na documentação e no README.
- **Cópia de segurança**: exportar todos os dados para um ficheiro JSON e importá-lo, juntando com o que já existe (sem duplicar registos). O ficheiro é validado e as linhas inválidas são descartadas.
- A folha da Conta passa a deslizar em ecrãs pequenos.

## v1.0.0 — primeira versão pública

### Aprendizagem

- **Domínio sem ajuda**: só testes de controlo em papel, sem consulta, dias depois; prática com e sem ajuda à parte; aviso de dependência de ajuda.
- **Registo do bloco** com a ordem certa: tentativas, confiança (1–4) e ajuda antes de corrigir; acertos depois. Autoexplicação opcional.
- **Calibração**: excesso de confiança detetado por disciplina e posto no topo do Progresso.
- **Datas de exame por disciplina**: véspera só de revisão, prioridade na semana final.
- **Distribuição do tempo** por ECTS × défice, com mínimo de 10%, enviada à IA.

### Percurso académico

- UCs por ano e semestre, **importação por foto** do plano de estudos.
- Média ponderada por ECTS, truncada como nos serviços académicos; nota para não baixar e para um objetivo.
- Provas com peso e nota mínima; épocas normal, recurso e especial; nota final calculada e arredondada.
- Pré-requisitos com base fraca → mais tempo e revisão da base.
- Quadro ano → semestre e **relatório de semestre** com previsão vs. nota.

### Plano

- Plano por utilizador: exemplo, à mão ou **gerado por IA** (Gemini, Claude ou compatível com OpenAI) com um prompt baseado em evidência.
- **Verificação científica** fixa de qualquer plano: carga, espaçamento, recuperação, técnicas passivas, línguas.

### Plataforma

- **Cloudflare Worker** serve a app e a API, com as chaves como segredos.
- **`npm start`** com ecrã **Servidor e chaves**: guardar chaves, criar tabelas, ligar a conta Cloudflare e publicar num clique; **painel de estado** por serviço.
- **Supabase**: login por código no email, um documento por utilizador com RLS, sincronização em tempo real.
- Timer pelo relógio, que sobrevive a segundo plano e ao fecho da app; modo foco com ecrã inteiro e ecrã sempre ligado.
- PWA offline; página de apresentação com as referências.
- Testes das regras (`npm test`), verificados com mutações.

## Antes da 1.0

Protótipo pessoal com Firebase e um plano fixo no código, redesenho da interface e primeira versão do timer. Substituído por completo na 1.0.
