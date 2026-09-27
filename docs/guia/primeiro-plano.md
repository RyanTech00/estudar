# O primeiro plano

O plano é a tua **semana tipo**: que disciplina estudas em cada dia, quanto tempo e com que atividade. Abre-o em **Semana → Editar plano** (ou **Criar plano** no ecrã inicial).

## Três formas de começar

1. **Plano de exemplo** — um plano completo de Engenharia Informática com duas línguas. Bom para veres como a app funciona.
2. **Do teu percurso** — se registaste as UCs em [Percurso académico](/funcionalidades/percurso), marca **"Estou a fazer esta UC agora"** e elas entram no plano com ECTS e datas de prova.
3. **À mão** — acrescenta disciplinas no editor.

## Preencher o essencial

| Campo | Para quê |
|---|---|
| **Datas** (início, exames) | Fases do semestre e contagem até aos exames |
| **Disciplinas**: nome, sigla, tipo, carga | Tipo = Universidade, Línguas ou Outros; carga = leve, média, alta |
| **ECTS** (opcional) | Base da distribuição de tempo |
| **Data do exame por disciplina** (opcional) | Véspera só de revisão; prioridade na semana final. Sem data? Usa a data geral — quando souberes, põe-na e tudo se ajusta |
| **Horas por dia** | A IA e a verificação não deixam passar desse limite |

## Gerar com IA

Em **Gerar com IA**, escreve notas se quiseres ("trabalho às terças à tarde", "o exame de FP é escrito") e carrega em **Gerar plano semanal**. A IA recebe as disciplinas, as datas, as horas e a **distribuição sugerida**, e tem de seguir as regras descritas em [Plano semanal com IA](/funcionalidades/plano-com-ia).

<Shot src="/screenshots/plano-distribuicao.png" alt="Distribuição sugerida do tempo por disciplina" caption="Distribuição sugerida: ECTS × o que falta dominar, com mínimo de 10% e prioridade para o exame mais próximo." />

## Rever antes de guardar

A IA pode errar. Por isso o editor corre uma **verificação científica** fixa — sempre, mesmo em planos feitos à mão:

<Shot src="/screenshots/plano-verificacao.png" alt="Verificação científica do plano" caption="Cada linha é uma regra. Um aviso não impede guardar, mas diz-te o que ajustar." />

- A carga de cada dia respeita as horas disponíveis?
- As disciplinas médias e pesadas aparecem em **pelo menos 2 dias** (espaçamento)? Uma revisão dentro da sessão de outra disciplina conta, se mencionar a sigla ("Rever SO").
- Há **prática de recuperação** (testar-se, recall, simulações, uma revisão acumulada)?
- Há sessões baseadas em **reler, sublinhar ou resumir**?
- As **línguas** têm sessões curtas e frequentes (3+ por semana)?

Podes apagar sessões ou acrescentar à mão em **+ Adicionar sessão à mão**. Quando estiver bem, **Guardar plano**.

## Quando mudar o plano

- **Soubeste uma data de exame** → põe-na na disciplina (ou na prova, no percurso). Não precisas de gerar de novo: os avisos e a prioridade ajustam-se.
- **Fizeste testes de controlo** → a distribuição sugerida muda com o teu domínio. Gera de novo quando a diferença para o plano for grande (o editor mostra "no plano: X%" ao lado).
- **Semestre novo** → no percurso, marca as UCs novas como "a fazer agora"; as aprovadas saem do plano sozinhas.
