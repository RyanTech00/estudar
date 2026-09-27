# Testes

```bash
npm test
```

Os testes cobrem as regras que decidem **o que conta como aprendizagem** e **as contas académicas** — o sítio onde um erro silencioso faria a app mentir ao estudante.

| Ficheiro | O que garante |
|---|---|
| `tests/learning.test.mjs` | Domínio só de testes sem ajuda (R7); prática com ajuda à parte; aviso de dependência; excesso de confiança (R6) e a ordem do Progresso; distribuição ECTS × défice com mínimo de 10% (R9); prioridade do exame próximo e véspera (R3); base fraca dá tempo sem mexer no domínio |
| `tests/curriculum.test.mjs` | Média por ECTS truncada (verificada contra um histórico real: 16,57 com 78 ECTS); nota para não baixar e para um objetivo; grupos de escolha; arredondamento oficial; avaliação distribuída com mínimos; recurso e época especial; próxima prova; pré-requisitos; ligação percurso → plano |
| `tests/backup.test.mjs` | A cópia de segurança recupera tudo menos o dono; ficheiros de outra app, não-JSON ou de versões futuras são recusados; linhas inválidas descartadas |
| `tests/import.test.mjs` | A saída da IA na importação por foto é limpa (notas 0–20, datas ISO, linhas vazias fora); só imagens JPEG/PNG/WebP |
| `tests/clean.test.mjs` | Os ataques da auditoria (XSS na nota, na cor, no id de uma UC, em datas; injeção de CSS pela cor) não sobrevivem ao filtro; dados malformados deixam de rebentar a app; campos desconhecidos são descartados; as cópias de segurança passam pelo mesmo filtro |
| `tests/owner-gate.test.mjs` | Com um Supabase simulado: `/api/health` publicado só para o dono; só o dono usa a IA; `OWNER_ID` vence o email; limite de IA atómico (429 / 503); pedidos grandes recusados antes de tudo; a resposta da IA é limpa; erros sem detalhes internos; a chave secreta nunca vai para o browser |
| `tests/roles.test.mjs` | Dono, leitor e sem acesso; instalações sem dono continuam a funcionar |
| `tests/keys.test.mjs` | Distingue chaves públicas e secretas do Supabase (novas e antigas) |

## Mutações

66 testes no total.

Um teste que passa não prova nada se também passasse com a regra partida. Por isso cada regra foi **estragada de propósito** e confirmou-se que pelo menos um teste falha (incluindo as proteções do Worker: tirar a verificação do dono na IA ou no `/api/health` faz falhar os testes):

| Mutação | Apanhada |
|---|---|
| Domínio conta testes com ajuda / conta prática | ✅ |
| Limiar de excesso de confiança removido | ✅ |
| Mínimo de 10% não aplicado | ✅ |
| Défice ignora o domínio | ✅ |
| Janela do exame ignorada / véspera desfasada um dia | ✅ |
| Progresso ignora o excesso de confiança | ✅ |
| Dependência de ajuda nunca avisa | ✅ |
| Média não ponderada / arredondada em vez de truncada | ✅ |
| Nota mínima ignorada / recurso não substitui / nota de aprovação fixa | ✅ |
| Grupos de escolha contados em duplicado | ✅ |
| "Para não baixar" arredondado para baixo | ✅ |
| Base fraca ignora "por fazer" ou o limiar | ✅ |
| Depois de reprovar, a época normal continua a marcar a data | ✅ (teste acrescentado quando esta mutação sobreviveu) |
| Data derivada gravada como manual | ✅ |

Ao alterar uma regra, repete o exercício: estraga-a, corre `npm test`, confirma que falha.

## Capturas da documentação

As imagens deste site são geradas por um script, com um **estudante fictício**:

```bash
cd docs
npm install
npm run screenshots
```

O script arranca o servidor local, semeia dados de demonstração, simula respostas do servidor onde é preciso (por exemplo, o painel todo verde) e grava cada ecrã em `docs/public/screenshots/` com o Edge ou o Chrome já instalados. Quando a interface muda, corre-o outra vez.
