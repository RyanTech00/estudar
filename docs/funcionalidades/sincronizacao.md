# Sincronização e offline

## Uma conta, vários dispositivos

Entras com o teu email (código de 6 dígitos, ou link) no telemóvel e no computador. O que fazes num aparece no outro em segundos, via Supabase Realtime.

<Shot src="/screenshots/login.png" alt="Ecrã de login por código" caption="Login por código: funciona dentro da PWA instalada, onde os links do email abririam no browser." />

### Como os dados se juntam

Cada utilizador tem **um documento JSON** (plano, registos, percurso, definições).

**Durante o uso**, cada alteração é enviada ~1 segundo depois e os outros dispositivos recebem-na em tempo real: a versão mais recente substitui a anterior (é assim que desmarcar algo num dispositivo desmarca no outro) — com uma exceção, os **registos de tentativas**, que se juntam sempre.

**Ao entrar num dispositivo**, a cópia local e a da nuvem juntam-se campo a campo:

| Dado | Regra |
|---|---|
| **Registos de tentativas** | Só se acrescentam; união por identificador — nenhum dispositivo apaga os de outro |
| Sessões feitas, minutos por dia | União; nos minutos fica o maior valor por dia e disciplina |
| Checklist semanal | Uma caixa marcada em qualquer dispositivo fica marcada |
| Plano, percurso, durações, definições | Vence a versão mais recente |
| Notas de exame | Vence a mais recente por disciplina |

- **Ao entrar num dispositivo**, a cópia local junta-se à da nuvem **antes** de gravar — um dispositivo vazio nunca apaga o que já existe.
- **Se a cópia local pertence a outra conta**, é descartada — nunca se mistura.
- As estatísticas (dias seguidos, horas, testes) são **calculadas a partir do histórico**, por isso não há contadores a divergir entre dispositivos.

## Offline

A app é uma **PWA**. O service worker:

- vai buscar sempre a versão mais recente quando há rede (e recarrega a página uma vez quando sai uma versão nova, se o timer estiver parado);
- serve a app da cache quando não há rede;
- guarda uma cópia do SDK do Supabase para a app abrir offline.

Offline, tudo funciona com a cópia local: plano, timer, registos, percurso. A sincronização retoma quando voltas a ter rede.

## Instalar

- **Android (Chrome)**: menu ⋮ → **Instalar app**.
- **iPhone (Safari)**: Partilhar → **Adicionar ao ecrã principal**.
- **Computador (Chrome/Edge)**: ícone de instalar na barra de endereço.

## Cópia de segurança

Em **Conta → Exportar cópia** descarregas um ficheiro `estudar-AAAA-MM-DD.json` com tudo: plano, registos, percurso e definições (sem o identificador da conta). **Importar cópia** junta-o ao que tens, com as mesmas regras de quando entras num dispositivo novo:

- os registos de tentativas juntam-se — importar duas vezes não duplica nada;
- sessões, minutos e checklist juntam-se por dia;
- no plano, no percurso e nas definições fica a versão mais recente.

Antes de juntar, a app mostra o que o ficheiro traz e pede confirmação. O ficheiro é tratado como não confiável: linhas inválidas (acertos acima das tentativas, notas fora de 0–20, datas mal formadas) são descartadas.

Serve para guardar uma cópia fora do Supabase, para mudar de projeto Supabase ou para passar os dados de modo local para uma conta.

## Terminar sessão

Apaga a cópia local neste dispositivo (dados, timer e sessão). Os dados continuam na tua conta.
