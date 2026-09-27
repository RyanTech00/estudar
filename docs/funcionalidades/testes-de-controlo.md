# Testes de controlo e domínio

O **domínio** de uma disciplina é a percentagem de acertos nos teus **testes de controlo** — e só neles.

<div class="shots">
  <Shot src="/screenshots/teste-controlo.png" alt="Configuração de um teste de controlo" caption="Antes do teste: regras, disciplina e tempo." />
  <Shot src="/screenshots/progresso.png" alt="Domínio sem ajuda por disciplina" caption="Progresso: domínio, excesso de confiança, dependência de ajuda, base fraca." />
</div>

## O que é um teste de controlo

Em **Progresso → Teste de controlo**:

- **em papel**, como no exame;
- **sem** apontamentos, IA ou exemplos resolvidos;
- com exercícios que **não** resolveste nos últimos 7 dias;
- **misturando** tópicos já dados, para teres de reconhecer que método usar;
- **com tempo** (15, 20, 30 ou 45 min) — corre no modo foco, marcado "sem consulta";
- no fim, o mesmo [registo](/funcionalidades/registo-do-bloco): confiança antes de corrigir, acertos depois.

Se disseres que usaste ajuda, o teste passa a contar como prática com ajuda e **não** entra no domínio.

::: tip Começar do zero é normal
O teste mede só a matéria **que já deste**, não a disciplina inteira. Sem testes, a disciplina aparece como "por aprender" — não é uma nota má, é um estado.
:::

## Como se calcula

```
domínio(d) = acertos / tentativas   nos 3 testes de controlo mais recentes, sem ajuda
```

- Os testes antigos saem de cena: um mau início não pesa para sempre.
- A **prática** — com ou sem ajuda — nunca entra no domínio. O desempenho durante o estudo é um mau previsor do que fica ([modelo central](/ciencia/#modelo-central)).

## O que o Progresso mostra

As disciplinas aparecem por esta ordem:

1. **Excesso de confiança** — esperavas acertar muito mais do que acertaste.
2. **Domínio medido mais baixo**.
3. **Ainda sem teste**, pela data de exame mais próxima (exames já feitos vão para o fim).

| Sinal | Quando aparece |
|---|---|
| **Excesso de confiança** | Confiança esperada ≥ 20 pp acima dos acertos, com 3+ registos |
| **Depende de ajuda** | 4+ registos de prática, ajuda em mais de metade, e ≥ 20 pp melhor com ajuda do que sem |
| **Teste em falta** | Há domínio medido, mas nenhum teste nos últimos 7 dias |
| **Base fraca** | Um pré-requisito por fazer, reprovado ou abaixo de 12 |

A **dependência de ajuda** é o efeito muleta de Bastani et al., medido nos teus próprios dados ([R7](/ciencia/#r7-com-ajuda-vs-sem-ajuda)).

## Sem exames antigos?

Os exercícios das fichas chegam. Guarda dois ou três de cada ficha sem os resolver e usa-os nos testes. O efeito vem da recuperação sem consulta, não da origem das perguntas.
