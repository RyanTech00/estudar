# Registo do bloco

No fim de cada bloco de estudo (5 minutos ou mais), a app pergunta o que aconteceu. Leva 20 segundos e é o que transforma "estudei 40 minutos" em informação útil.

<div class="shots">
  <Shot src="/screenshots/registo-bloco.png" alt="Registo antes de corrigir" caption="Passo 1: tentativas, confiança e ajuda — antes de corrigir." />
  <Shot src="/screenshots/registo-feedback.png" alt="Resultado depois de corrigir" caption="Passo 2: acertos e a leitura do resultado." />
</div>

## A ordem é o ponto

1. **O que fizeste?**
   - **Matéria nova** — primeira exposição a um tema. Fica registada, mas **nunca** conta para o domínio: ler serve para conhecer a matéria, não para a reter.
   - **Exercícios / recuperação** — tentaste resolver ou lembrar.
2. **Quantos exercícios ou perguntas tentaste?** Um exercício em branco conta como tentado e errado: comprometeres-te com uma resposta é parte do efeito.
3. **Antes de corrigires: quão seguro estás?** — de 1 (*nada seguro*) a 4 (*muito seguro*).
4. **Usaste IA, apontamentos ou exemplos resolvidos?**
5. **Confirmar e ir corrigir** — a confiança e a ajuda **ficam trancadas**. Só agora aparece o campo **quantos acertaste**, limitado ao número de tentativas.

Uma confiança dada depois de ver as soluções já não é uma previsão. Esta ordem implementa, para estudo em papel, a regra **"tentar antes de revelar"** ([R1](/ciencia/#r1-tentar-antes-de-revelar)).

## Autoexplicação

De três em três registos de prática, aparece um campo opcional: *"explica numa frase porque é que um dos passos funciona, sem olhar"*. É moderado de propósito, para não transformar cada bloco num ensaio ([R5](/ciencia/#r5-autoexplicacao)).

## O que acontece aos dados

| Registo | Vai para |
|---|---|
| Matéria nova | Histórico (primeira exposição) — não conta para nada |
| Prática **sem ajuda** | "Prática sem ajuda" e calibração |
| Prática **com ajuda** | "Prática com ajuda" — **nunca** para o domínio |
| Confiança (qualquer prática ou teste) | Calibração: confiança esperada vs. acertos reais |

O domínio vem só dos [testes de controlo](/funcionalidades/testes-de-controlo).

## Calibração

Cada nível de confiança corresponde a uma taxa de acerto esperada (1 → 25%, 2 → 50%, 3 → 75%, 4 → 95%). Com 3 ou mais registos numa disciplina, a app compara a média esperada com o que acertaste. Se esperavas **20 pontos percentuais ou mais** acima do que acertaste, a disciplina fica marcada com **excesso de confiança** e sobe para o topo do Progresso — acima das que são simplesmente fracas ([R6](/ciencia/#r6-confianca-e-calibracao)).
