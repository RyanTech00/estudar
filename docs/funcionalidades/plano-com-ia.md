# Plano semanal com IA

O plano é a semana tipo: por cada dia, as sessões — disciplina, duração e **atividade concreta**. Podes criá-lo à mão, a partir do exemplo ou gerá-lo com IA.

<Shot src="/screenshots/semana.png" alt="Separador Semana com fases e plano semanal" caption="Semana: a linha das fases até aos exames e o plano de cada dia, com as sessões já feitas assinaladas." />

## O que a IA recebe

- Disciplinas: nome, sigla, tipo, carga, **ECTS**, **data de exame**.
- **Fatia sugerida** de tempo e **domínio medido** de cada uma (ver [distribuição](#distribuicao-do-tempo)).
- **Base fraca**: pré-requisitos por fazer, reprovados ou com nota baixa.
- Datas de início e de exames, horas disponíveis por dia e as tuas notas.

## As regras que tem de seguir

O prompt do sistema obriga a IA a:

1. **Prática de recuperação** em cada sessão — exercícios, perguntas sem apontamentos, explicar de memória. Nunca reler, sublinhar ou resumir como atividade principal.
2. **Espaçamento** — disciplinas médias e pesadas em pelo menos 2 dias não consecutivos, com revisões curtas 1–3 dias depois.
3. **Intercalação** — exercícios mistos; sessão principal + revisão de outra disciplina no mesmo dia.
4. Uma **sessão semanal de recuperação acumulada**.
5. **Blocos com pausas**, sem passar das horas de cada dia.
6. **Sono e carga** — se as horas não chegam, reduz primeiro as disciplinas leves e as línguas, nunca o espaçamento das pesadas.
7. **Línguas** em sessões curtas e frequentes.
8. **Distribuição do tempo** segundo a fatia sugerida; o exame mais próximo tem prioridade.
9. **Base fraca** → sessões curtas de recuperação do pré-requisito nas primeiras semanas.
10. **Primeira exposição** em bloco; depois, prática mista.
11. **Fases** até ao exame, terminando em simulações em condições de exame.

A resposta é **JSON estruturado** (com esquema), limpa e validada antes de aparecer: dias 0–6, só disciplinas que existem, datas no formato certo.

## Verificação científica

Mesmo assim, a IA pode errar. O editor corre regras fixas sobre qualquer plano:

<Shot src="/screenshots/plano-verificacao.png" alt="Verificação científica no editor de plano" />

| Regra | Aviso quando |
|---|---|
| Carga | Um dia passa mais de 15% das horas disponíveis |
| Cobertura | Uma disciplina não tem nenhuma sessão |
| Espaçamento | Uma disciplina média ou pesada aparece num só dia (revisões com a sigla contam) |
| Recuperação | Não há nenhuma sessão de teste, recall, simulação ou revisão acumulada |
| Técnicas passivas | Há sessões baseadas em reler, sublinhar ou resumir |
| Línguas | Menos de 3 sessões por semana |

## Distribuição do tempo

::: warning Heurística, não ciência da aprendizagem
Não há evidência que ligue o tempo por disciplina aos ECTS. Esta regra decide **quanto** tempo; os princípios decidem **como**. Os parâmetros são ajustáveis e devem ser confirmados com os teus testes de controlo.
:::

```
prioridade(d) = ECTS(d) × défice(d) × [2 se exame nos próximos 7 dias] × [1,25 se base fraca]
défice(d)     = 1 − domínio(d)          — só de testes sem ajuda; sem teste, 1
                + 0,2 se houver excesso de confiança
fatia(d)      = max(10%, prioridade / Σ prioridades), renormalizado
```

- Antes do primeiro teste, a distribuição é proporcional aos ECTS (sem ECTS, usa a carga).
- Nenhuma disciplina desce abaixo de 10% — o espaçamento nunca a deixa esquecida semanas.
- Disciplinas com exame já feito saem da distribuição.

<Shot src="/screenshots/plano-distribuicao.png" alt="Distribuição sugerida no editor" caption="Ao lado de cada fatia: porquê (domínio, exame, base fraca) e quanto tem no plano atual." />

## Fornecedores

| `AI_PROVIDER` | Como é chamado |
|---|---|
| `gemini` | REST `generateContent` com `responseSchema` |
| `anthropic` | SDK oficial `@anthropic-ai/sdk`, saída estruturada (`output_config.format`) e *fallback* do lado do servidor se o modelo recusar |
| `openai` | `chat/completions` com `response_format: json_schema` — serve OpenAI, OpenRouter, Groq e outros |
