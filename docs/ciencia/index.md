# Princípios da aprendizagem

Esta página traduz a evidência da ciência da aprendizagem em **regras de desenho** do Estudar. Cada regra diz a evidência, a regra e **o estado atual** na app. As regras são invariantes: se uma funcionalidade entra em conflito com uma regra, muda a funcionalidade.

**Força da evidência**

- **ALTA** — resultados experimentais replicados; utilidade alta segundo Dunlosky et al. (2013).
- **MODERADA** — bom suporte experimental, em condições mais estreitas.
- **EMERGENTE** — poucos estudos; implementar, instrumentar e verificar com os nossos dados.

Relatórios observacionais servem de contexto: motivam o problema, mas não justificam decisões sozinhos.

## Estado da implementação

| Regra | Evidência | Estado |
|---|---|---|
| [Modelo central](#modelo-central) | ALTA | <span class="st ok">Implementado</span> |
| [R1 Tentar antes de revelar](#r1-tentar-antes-de-revelar) | ALTA + EMERGENTE | <span class="st part">Em papel</span> |
| [R2 IA só depois de tentar](#r2-a-ia-e-uma-ferramenta-pos-tentativa) | EMERGENTE | <span class="st ok">Cumprido</span> |
| [R3 Espaçamento com prazo](#r3-espacamento-com-prazo-de-exame) | ALTA | <span class="st part">Ao nível da sessão</span> |
| [R4 Intercalação](#r4-intercalacao) | MODERADA | <span class="st part">Ao nível do plano</span> |
| [R5 Autoexplicação](#r5-autoexplicacao) | MODERADA | <span class="st part">Pedido opcional</span> |
| [R6 Confiança e calibração](#r6-confianca-e-calibracao) | ALTA | <span class="st ok">Implementado</span> |
| [R7 Com ajuda vs. sem ajuda](#r7-com-ajuda-vs-sem-ajuda) | EMERGENTE | <span class="st ok">Implementado</span> |
| [R8 Técnicas de baixa utilidade](#r8-tecnicas-de-baixa-utilidade-nao-sao-modo-de-estudo) | ALTA (negativa) | <span class="st ok">Implementado</span> |
| [R9 Tempo por disciplina](#r9-distribuicao-do-tempo) | Heurística | <span class="st ok">Implementado</span> |

"Em papel", "ao nível da sessão" e "ao nível do plano" significam que a regra está aplicada ao que a app conhece hoje — sessões e registos — e não a itens individuais, que só existirão com o banco de perguntas ([roadmap](/roadmap)).

## Modelo central

A aprendizagem mede-se pela **recuperação sem ajuda, depois de algum tempo** — nunca pelo desempenho durante o estudo. O desempenho durante a prática é um sinal enganador:

- reler pareceu melhor e reteve menos (Roediger & Karpicke, 2006);
- a prática em bloco teve melhores resultados no treino e muito piores uma semana depois (Rohrer & Taylor, 2007);
- com um tutor de IA, o desempenho com ajuda subiu e o desempenho sem ajuda caiu (Bastani et al.).

**No Estudar:** o domínio vem só de testes de controlo sem ajuda; horas, prática e prática com ajuda aparecem à parte.

## R1. Tentar antes de revelar

**Evidência.** Efeito de testagem (Roediger & Karpicke, 2006; Karpicke & Blunt, 2011). Efeito muleta (Bastani et al.): um tutor que dava respostas prejudicou o desempenho sem ajuda; um que obrigava a raciocinar primeiro removeu grande parte do prejuízo.

**Regra.** Nada que contenha ou implique a resposta é mostrado antes de haver uma tentativa registada. Uma tentativa vazia conta, mas vale como falhada.

**No Estudar (modo papel).** O registo do bloco pede tentativas, confiança e ajuda usada **antes** de corrigir; esses campos ficam trancados; só depois aparecem os acertos, limitados às tentativas. Um exercício em branco conta como tentado e errado. A autoavaliação fica marcada como tal e é comparada com os testes de controlo (R6).

## R2. A IA é uma ferramenta pós-tentativa

**Regra.** Antes da tentativa, só pistas que não revelem a resposta. Depois, corrigir, explicar e gerar variantes. Em testes de controlo e simulações, nenhuma.

**No Estudar.** A IA só gera o plano semanal e lê a imagem do percurso; nunca vê exercícios nem respostas. A prática feita com IA é registada como "com ajuda" e nunca conta para o domínio. Um tutor por fases é trabalho futuro e terá de respeitar esta tabela.

## R3. Espaçamento, com prazo de exame

**Evidência.** Ebbinghaus (1885); Cepeda et al. (2006, meta-análise); Cepeda et al. (2008): o intervalo ótimo entre revisões ronda 10–20% do tempo até ao teste.

**Regra.** Cada disciplina tem data de exame; o espaçamento garante revisão na janela final; a véspera do exame é só de revisão.

**No Estudar.** Datas de exame por disciplina (ou pela próxima prova no percurso); véspera marcada como "só recuperação e revisão, sem matéria nova"; prioridade nos últimos 7 dias; o plano exige cada disciplina média ou pesada em 2+ dias, com revisões 1–3 dias depois. O agendamento por item (FSRS) chega com o banco de perguntas.

## R4. Intercalação

**Evidência.** Rohrer & Taylor (2007): prática mista ~63% vs. em bloco ~20% num teste uma semana depois — o ganho vem de ter de identificar que método se aplica.

**Regra.** A primeira exposição pode ser em bloco; revisão e prática intercalam tópicos e tipos de problema.

**No Estudar.** O plano pede exercícios mistos e revisões cruzadas no mesmo dia; os testes de controlo pedem tópicos misturados; a primeira exposição fica registada à parte.

## R5. Autoexplicação

**Regra.** Depois de uma tentativa, às vezes pedir para explicar *porquê* um passo funciona — com moderação.

**No Estudar.** De três em três registos de prática, um campo opcional pede uma frase de autoexplicação.

## R6. Confiança e calibração

**Evidência.** Ilusão de competência: quem relê prevê melhores resultados do que quem se testa, e erra (Roediger & Karpicke, 2006). Bjork (1994): o estudo fluente parece eficaz e não é.

**Regra.** Antes de revelar, a confiança (1–4). Calibração por disciplina. As disciplinas com **excesso de confiança** ficam acima das simplesmente fracas.

**No Estudar.** Exatamente isso — ver [Registo do bloco](/funcionalidades/registo-do-bloco#calibracao).

## R7. Com ajuda vs. sem ajuda

**Regra.** O domínio calcula-se só com recuperação sem ajuda. O desempenho com ajuda aparece à parte e nunca o inflaciona. Medir a diferença entre os dois: uma diferença crescente é o efeito muleta nos nossos dados.

**No Estudar.** Domínio só de testes de controlo sem ajuda; prática com e sem ajuda lado a lado; aviso de **dependência de ajuda**; testes com ajuda passam a prática.

## R8. Técnicas de baixa utilidade não são modo de estudo

**Evidência.** Dunlosky et al. (2013): reler, sublinhar e resumir têm utilidade baixa.

**No Estudar.** Ler matéria nova é registado como primeira exposição e nunca conta para o domínio; a app não oferece resumos gerados por IA; o prompt proíbe essas técnicas como atividade principal e a verificação do plano avisa quando aparecem.

## R9. Distribuição do tempo

**Estado.** Heurística de planeamento, **não** ciência da aprendizagem. Decide *quanto* tempo; R1–R8 decidem *como*.

```
prioridade(d) = ECTS(d) × défice(d)
fatia(d)      = max(10%, prioridade / Σ prioridades), renormalizado
défice(d)     = 1 − domínio sem ajuda(d)     — sem teste, 1
```

Excesso de confiança aumenta o défice; o exame mais próximo passa à frente; exames já feitos saem. Detalhes e parâmetros em [Plano semanal com IA](/funcionalidades/plano-com-ia#distribuicao-do-tempo).

## Como estas regras são garantidas

Cada regra com consequência mensurável tem um **teste automático**, e cada teste é verificado estragando a regra de propósito (mutação) para confirmar que o teste a apanha. Ver [Testes](/arquitetura/testes).

## Medir antes de decidir

Depois de duas semanas de uso, compara os testes de controlo com a prática com ajuda **antes** de afinar qualquer parâmetro. O [relatório de semestre](/funcionalidades/relatorio-de-semestre) mostra se os teus testes previam bem as notas.
