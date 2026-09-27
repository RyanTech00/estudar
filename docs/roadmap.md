# Roadmap

O que vem a seguir segue a mesma regra do resto do projeto: **medir antes de decidir**. Nada entra por parecer útil; entra quando os dados mostram que falta.

## Próximo

- **Afinar com dados reais.** Depois de duas semanas de uso, comparar testes de controlo com prática com ajuda antes de mexer em qualquer parâmetro (limiar de excesso de confiança, fator de base fraca, mínimo de 10%).
- **Lembretes** do teste de controlo semanal e da véspera de exame (notificações da PWA).
- **Idiomas:** interface em inglês.

## Fase B — banco de perguntas

A versão atual trabalha ao nível da **sessão**: sabes o que fizeste, com que confiança e com que ajuda. A fase B leva as regras ao nível do **item** (cada pergunta ou exercício):

| Regra | Com itens |
|---|---|
| **R1** tentar antes de revelar | Um único ponto no servidor decide se a solução de um item pode ser mostrada; só depois de uma tentativa registada nessa sessão. Testado com mutações |
| **R2** IA por fases | Antes da tentativa, só pistas (reformular, apontar o conceito, perguntar), com verificação de fuga contra a solução guardada; depois, corrigir e explicar; em testes, nada. `hint_level_used` por tentativa |
| **R3** espaçamento | FSRS por item, com as revisões limitadas à data de exame de cada disciplina |
| **R4** intercalação | O construtor de sessões nunca põe mais de 2 itens seguidos do mesmo tópico; itens de "que método se aplica?" |
| **R6** calibração | Por tópico, não só por disciplina |

**A condição para avançar** é o conteúdo: um banco de itens exige perguntas corretas por disciplina. Itens gerados por IA entram como pendentes e só são servidos depois de validados — zero itens é melhor do que itens errados.

## Considerado e posto de lado

- **Resumos gerados por IA** — utilidade baixa (Dunlosky et al., 2013).
- **Tutor de IA que dá respostas** — efeito muleta (Bastani et al.).
- **Pontos, medalhas e rankings por horas** — recompensariam o sinal errado.

Tens uma ideia? [Abre uma issue](https://github.com/RyanTech00/estudar/issues).
