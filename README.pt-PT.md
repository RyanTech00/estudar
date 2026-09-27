<div align="center">

<img src="public/icons/icon.svg" alt="Estudar" width="88">

# Estudar

[English](README.md) · **Português**

**Estuda para lembrar no dia do exame — não só no dia em que estudas.**

<img src="docs/public/screenshots/hoje-desktop.png" alt="Estudar: o separador Hoje" width="820">

[![npm](https://img.shields.io/npm/v/estudar.svg?color=cfe86a)](https://www.npmjs.com/package/estudar)
[![Licença: MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-cfe86a.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-offline-5fcdc2.svg)](docs/funcionalidades/sincronizacao.md)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)](https://workers.cloudflare.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ecf8e.svg)](https://supabase.com)
[![Testes](https://img.shields.io/badge/testes-npm%20test-8ea7ff.svg)](docs/arquitetura/testes.md)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/RyanTech00/estudar)

<a href="https://www.buymeacoffee.com/ryanbarbosa"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=ryanbarbosa&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coffee" height="40" /></a>

[Documentação](docs/) · [Começar](docs/guia/comecar.md) · [A ciência](docs/ciencia/index.md) · [Arquitetura](docs/arquitetura/index.md)

</div>

---

## O que é

Um sistema de estudo open source para o ensino superior. Organiza a semana com IA, guia cada sessão em blocos de foco e mede o que sabes **sem ajuda** — porque a investigação mostra que horas de estudo e desempenho durante a prática são maus sinais de aprendizagem (Roediger & Karpicke, 2006; Rohrer & Taylor, 2007; Bastani et al.).

## Funcionalidades

- **Plano semanal com IA** — a partir das disciplinas, datas e horas livres, com recuperação, espaçamento e intercalação; uma **verificação científica** fixa avisa o que ajustar. Gemini, Claude ou qualquer API compatível com OpenAI.
- **Modo foco** — blocos 40+10 em ecrã inteiro, ecrã sempre ligado, timer que sobrevive ao telemóvel fechar a app.
- **Registo do bloco** — tentativas, confiança e ajuda usada **antes** de corrigir; acertos depois.
- **Domínio sem ajuda** — só de testes de controlo em papel, sem consulta; prática com ajuda à parte, com aviso de dependência.
- **Calibração** — as disciplinas onde a confiança te engana sobem para o topo.
- **Percurso académico** — importação por foto, média por ECTS, nota para não baixar, provas com pesos e mínimos, recurso e época especial, pré-requisitos, relatório de semestre.
- **Configuração dentro da app** — chaves, tabelas e publicação no Cloudflare num ecrã, com um ponto de estado por serviço.
- **Sincronização e offline** — telemóvel ↔ computador em tempo real; PWA instalável; cópia de segurança em JSON.
- **Português e inglês** — interface, mensagens do servidor e planos da IA na língua escolhida (**Conta → Idioma**).

<table>
  <tr>
    <td><img src="docs/public/screenshots/progresso.png" alt="Domínio sem ajuda" width="200"></td>
    <td><img src="docs/public/screenshots/registo-bloco.png" alt="Registo do bloco" width="200"></td>
    <td><img src="docs/public/screenshots/relatorio-semestre.png" alt="Relatório de semestre" width="200"></td>
    <td><img src="docs/public/screenshots/servidor-estado.png" alt="Servidor e chaves" width="200"></td>
  </tr>
</table>

## Início rápido

```bash
npx estudar        # abre http://localhost:8787 (precisa do Node.js 20+)
```

Na app: **Conta → Servidor e chaves** → cola o Supabase e a chave de IA → **Testar → Guardar** → **Ligar conta Cloudflare → Publicar**. As chaves ficam em `~/.estudar`. Guia completo em [docs/guia/instalacao.md](docs/guia/instalacao.md).

Sem configurar nada, a app já funciona em modo local (dados só no browser).

## Como está feito

| Peça | Tecnologia |
|---|---|
| App | PWA sem build — HTML, CSS, ES modules (`public/`) |
| Servidor | Um Cloudflare Worker serve a app e a API; `npm start` corre a mesma API localmente |
| Dados | Supabase: login por código no email, um documento JSON por utilizador com RLS, Realtime |
| IA | Configurável; a chave só existe no servidor |
| Regras | `learning.js` e `curriculum.js`, funções puras com testes verificados por mutação |

Mais em [Arquitetura](docs/arquitetura/index.md) e [Modelo de dados](docs/arquitetura/dados.md).

## Desenvolvimento

```bash
git clone https://github.com/RyanTech00/estudar.git
cd estudar
npm install

npm start            # app + API + ecrã de configuração
npm test             # regras de aprendizagem e do percurso
npm run check        # build do Worker sem publicar

cd docs
npm install
npm run dev          # site de documentação
npm run screenshots  # regenera as capturas com um estudante fictício
npm run build        # compila e verifica links e âncoras
```

## Contribuir

Issues e pull requests são bem-vindos — vê o [guia de contribuição](CONTRIBUTING.md). Antes de mexer numa regra de aprendizagem, lê [os princípios](docs/ciencia/index.md): são invariantes, e cada uma tem testes.

## Apoiar

O Estudar é grátis e continua a ser. Se te poupou tempo — ou uma cadeira —, um café ajuda a mantê-lo.

<a href="https://www.buymeacoffee.com/ryanbarbosa"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=ryanbarbosa&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coffee" /></a>

<img src="docs/public/bmc-qr.webp" alt="Código QR para buymeacoffee.com/ryanbarbosa" width="160">

## Star History

<a href="https://www.star-history.com/?repos=ryantech00%2Festudar&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ryantech00/estudar&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ryantech00/estudar&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=ryantech00/estudar&type=date&legend=top-left" />
 </picture>
</a>

## Licença

[MIT](LICENSE) © 2026 Ryan Barbosa

<sub>Co-Authored-By: Claude Opus 5.5</sub>
