# Timer e modo foco

<div class="shots">
  <Shot src="/screenshots/timer.png" alt="Separador Timer" caption="Timer: disciplina, anel de progresso e blocos do ciclo." />
  <Shot src="/screenshots/foco.png" alt="Modo foco em ecrã inteiro" caption="Modo foco: só o tempo, a fase e os controlos." />
</div>

## Blocos

Por defeito, **40 min de estudo + 10 de pausa**, com uma **pausa longa de 15 min** a cada 4 blocos. As durações ajustam-se em **Timer → Durações**. Os 40 minutos são práticos, não uma regra biológica: ajusta entre 30 e 60 conforme o foco.

- As **pausas arrancam sozinhas**; o bloco de estudo seguinte **espera por ti**.
- Um bloco de estudo com 5 minutos ou mais termina com o [registo do bloco](/funcionalidades/registo-do-bloco).
- Os minutos de estudo ficam registados na disciplina escolhida.

## Modo foco

**Modo foco** (ou **Começar foco** no Hoje) abre um ecrã sem distrações:

- **ecrã inteiro** (Fullscreen API) quando o dispositivo o permite;
- **ecrã sempre ligado** (Wake Lock API), recuperado quando voltas à app;
- **espaço** pausa e retoma no computador; **Esc** ou **Sair** fecha.

## Um timer que não mente

Os browsers abrandam os temporizadores quando o ecrã bloqueia ou a app vai para segundo plano, e o sistema pode fechar a PWA a meio. Por isso o timer:

- guarda a **hora de fim** do bloco, não a contagem de segundos — o tempo restante é sempre calculado a partir do relógio;
- grava o seu estado a cada mudança; ao voltar à app, retoma exatamente onde devia estar;
- se o bloco terminou enquanto a app estava fechada, **regista-o** e arranca a pausa.

O código está em [`public/js/timer.js`](https://github.com/RyanTech00/estudar/blob/main/public/js/timer.js).
