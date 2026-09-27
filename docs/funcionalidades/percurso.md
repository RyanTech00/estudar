# Percurso académico

O percurso guarda **todas as UCs do curso**: aprovadas, creditadas, em curso e por fazer, com as suas provas. Abre-se em **Progresso → Percurso → Gerir** ou **Conta → Percurso académico**.

<Shot src="/screenshots/percurso-resumo.png" alt="Gestor do percurso com média e objetivo" wide caption="O gestor: curso, média atual, objetivo e o que precisas nas UCs que faltam." />

## Registar as UCs

### Por fotografia

Tira uma foto ou uma captura de ecrã do teu plano de estudos (a tabela dos serviços académicos com ECTS e notas) e escolhe **Importar de uma imagem**. A IA lê a tabela — ano, semestre, UC, ECTS, nota, data, tipo (ex. CC) e grupos de escolha — e mostra-a numa lista editável. **Nada é guardado sem confirmares.** UCs com o mesmo nome são atualizadas, não duplicadas.

A imagem é reduzida no telemóvel antes de ser enviada, e o resultado é limpo no servidor: notas só entre 0 e 20, datas só em AAAA-MM-DD, linhas sem nome descartadas.

### À mão

**+ Adicionar UC** abre o editor. Funciona sem IA e sem internet.

## A média

<Shot src="/screenshots/percurso-card.png" alt="Percurso no Progresso: média por ano e semestre" caption="No Progresso: média, o que precisas para não baixar e o quadro por ano e semestre." />

- **Ponderada por ECTS** das UCs aprovadas (incluindo creditações), **truncada** a 2 casas — como nos serviços académicos. Testado com um histórico real: 16,57 com 78 ECTS.
- **Para não baixar**: a nota inteira mínima que mantém a média em cada UC que falta (com 16,57, é 17 — um 16 já a baixaria).
- **Objetivo**: define uma média alvo e a app calcula a média de que precisas nos ECTS que faltam, ou avisa se já não é alcançável.
- **Grupos de escolha** (opção, trabalho final): só contam os que escolheres — Estágio **ou** Projeto, não os dois.

## Provas, épocas e recurso

<Shot src="/screenshots/percurso-uc.png" alt="Editor de uma UC com provas, pesos e mínimos" wide caption="Uma UC com avaliação distribuída: dois testes com peso e nota mínima." />

| Caso | Como registar |
|---|---|
| **Exame final** | Uma prova, peso 100 |
| **Avaliação distribuída** | Uma linha por componente (teste, trabalho, frequência…), com **peso** e **nota mínima** se houver (ex. 7,5) |
| **Recurso / época especial** | Uma prova com a época **Recurso** ou **Especial** |
| **Creditação / equivalência** | Nota final oficial com o tipo **CC** |

Regras:

- **Aprovação** a partir de 9,5 por defeito — ajustável por UC.
- **Nota final** calculada pelos pesos quando todas as componentes da época normal têm nota, **arredondada** como as notas oficiais (9,5 → 10). Uma nota final oficial, se a escreveres, prevalece.
- Uma componente **abaixo do mínimo** → a UC passa logo a **reprovada**, mesmo antes das outras provas, e segue para recurso.
- Uma prova de **recurso ou especial** com nota **substitui** o resultado da época normal.
- A **próxima prova** (a mais próxima, ainda sem nota) passa a ser a **data de exame** da UC no plano. Depois de reprovar, só contam as provas de recurso/especial.
- **Reprovada sem data de recurso** → aviso no separador Hoje até a acrescentares.

## Pré-requisitos

Em cada UC marcas as UCs de que ela depende (ex. Estruturas de Dados → Programação I). Se alguma estiver:

- **por fazer ou em curso** (fazes a UC antes da sua base),
- **reprovada**, ou
- **aprovada abaixo de 12**,

a UC fica com **base fraca**: recebe mais tempo na distribuição (×1,25) e a IA acrescenta, nas primeiras semanas, sessões curtas de recuperação dos tópicos dessa base.

::: info O domínio da UC nova não muda
Uma nota baixa na base não prova que não sabes a UC nova — é matéria nova e começa sempre "por aprender". O conhecimento prévio prevê bem a aprendizagem nova; **quanto** tempo extra isso justifica é uma heurística (o limiar 12 e o fator 1,25 são ajustáveis), confirmada depois pelos testes de controlo.
:::

## Do percurso para o plano

**"Estou a fazer esta UC agora"** põe a UC no plano, com ECTS, carga e data de exame vinda das provas. Quando a UC é aprovada, sai do plano sozinha e fica no histórico. **"Pôr as UCs por fazer deste semestre no plano"** faz isto para um semestre inteiro de uma vez.
