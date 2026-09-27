# Changelog

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
