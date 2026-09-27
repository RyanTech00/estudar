# Começar

O **Estudar** é um sistema de estudo para o ensino superior. Organiza a tua semana, guia cada sessão em blocos de foco e mede o que sabes **sem ajuda** — porque é isso que conta no dia do exame.

<Shot src="/screenshots/hoje-desktop.png" alt="O separador Hoje no computador" wide caption="O separador Hoje: a sessão seguinte, os avisos de exame e o progresso do dia." />

## Para quem é

- Estudantes universitários com várias disciplinas, provas com pesos e mínimos, épocas de recurso e uma média para manter ou subir.
- Quem quer estudar como a investigação recomenda — testar-se, espaçar, intercalar — sem ter de desenhar o método sozinho.
- Quem estuda no telemóvel e no computador e quer tudo sincronizado.
- Quem prefere ter os dados no seu próprio servidor, grátis, e o código aberto.

## A ideia central

> A aprendizagem mede-se pela **recuperação sem ajuda, depois de algum tempo** — nunca pelas horas nem pelo desempenho durante o estudo.

É por isso que o Estudar separa duas coisas que a maioria das apps mistura:

| O que a app regista | Conta para o teu **domínio**? |
|---|---|
| Horas de estudo, sessões feitas, dias seguidos | Não — aparece como contexto |
| Exercícios feitos com IA, apontamentos ou exemplos | Não — aparece à parte, com aviso de dependência |
| Exercícios feitos de memória durante o estudo | Não — é prática; o efeito ainda não teve tempo de se provar |
| **Testes de controlo**: em papel, sem consulta, dias depois | **Sim — é a única medida** |

A explicação completa, com as referências, está em [Ciência da aprendizagem](/ciencia/).

## Como é um dia

1. **Hoje** mostra a sessão seguinte do teu plano e avisos (exame próximo, véspera de exame, recurso por marcar).
2. **Começar foco** abre o modo foco: ecrã inteiro, ecrã sempre ligado, blocos de 40+10.
3. No fim de cada bloco, **registas o que tentaste** e quão seguro estás — **antes** de corrigir. Só depois indicas os acertos.
4. Uma vez por semana, por disciplina, fazes um **teste de controlo**. É daí que vem o teu domínio.
5. **Progresso** mostra primeiro onde a tua confiança te engana, depois onde estás mais fraco, e depois o que tem exame mais perto.

<div class="shots">
  <Shot src="/screenshots/hoje.png" alt="Hoje" caption="Hoje" />
  <Shot src="/screenshots/foco.png" alt="Modo foco" caption="Modo foco" />
  <Shot src="/screenshots/registo-bloco.png" alt="Registo do bloco" caption="Registo do bloco" />
  <Shot src="/screenshots/progresso.png" alt="Progresso" caption="Progresso" />
</div>

## O que precisas

| Para… | Precisas de |
|---|---|
| Experimentar (dados só no browser) | [Node.js](https://nodejs.org) 20+ e `npm start` |
| Conta, sincronização entre dispositivos | Um projeto [Supabase](https://supabase.com) (nível gratuito) |
| Gerar planos e ler o plano de estudos por foto | Uma chave de IA — o [Gemini](https://aistudio.google.com/apikey) tem nível gratuito |
| Aceder de qualquer lado, instalar no telemóvel | Uma conta [Cloudflare](https://dash.cloudflare.com) (nível gratuito) |

Tudo isto configura-se **dentro da app**, no ecrã [Servidor e chaves](/guia/configuracao).

## Próximos passos

- [Instalação](/guia/instalacao) — do `git clone` à app publicada, em minutos.
- [O primeiro plano](/guia/primeiro-plano) — do plano de exemplo ao teu, gerado pela IA.
- [O dia a dia](/guia/dia-a-dia) — como usar a app para tirar o máximo do método.
