<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'

const REPO = 'https://github.com/RyanTech00/estudar'
const INSTALL = 'git clone https://github.com/RyanTech00/estudar && cd estudar && npm install && npm start'

const copied = ref(false)
function copyInstall() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(INSTALL)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

const features = [
  { icon: 'plan', title: 'Plano semanal com IA', desc: 'Colocas disciplinas, datas e horas livres; a IA monta a semana com recuperação, espaçamento e intercalação. A app verifica o resultado antes de o guardares.', link: '/funcionalidades/plano-com-ia' },
  { icon: 'focus', title: 'Modo foco', desc: 'Blocos de 40+10 em ecrã inteiro, ecrã sempre ligado e um timer que sobrevive ao telemóvel fechar a app a meio.', link: '/funcionalidades/timer-e-foco' },
  { icon: 'target', title: 'Domínio sem ajuda', desc: 'O teu nível vem de testes de controlo em papel, sem consulta — não de horas nem do que acertas com ajuda.', link: '/funcionalidades/testes-de-controlo' },
  { icon: 'gauge', title: 'Calibração da confiança', desc: 'Dizes quão seguro estás antes de corrigir. As disciplinas onde a confiança te engana sobem para o topo.', link: '/funcionalidades/registo-do-bloco' },
  { icon: 'cap', title: 'Percurso académico', desc: 'Médias por ano e semestre, provas com peso e mínimos, recurso e época especial, pré-requisitos. Importa o plano de estudos por foto.', link: '/funcionalidades/percurso' },
  { icon: 'cloud', title: 'Configura tudo na app', desc: 'Chaves, tabelas e publicação no Cloudflare num ecrã, com um ponto verde por serviço. Corre no teu PC ou em qualquer lado, grátis.', link: '/guia/configuracao' },
]

const day = [
  { img: '/screenshots/hoje.png', title: '1. Hoje', text: 'Vês o que vem a seguir e os avisos de exame. Um toque começa o foco.' },
  { img: '/screenshots/foco.png', title: '2. Foco', text: 'Ecrã inteiro, sem distrações. O bloco conta pela hora real, mesmo com o ecrã bloqueado.' },
  { img: '/screenshots/registo-bloco.png', title: '3. Registo', text: 'No fim, o que tentaste e quão seguro estás — antes de corrigir. Só depois os acertos.' },
  { img: '/screenshots/progresso.png', title: '4. Progresso', text: 'Domínio medido sem ajuda, excesso de confiança e dependência de ajuda à vista.' },
]

const science = [
  { rule: 'Testar-te em vez de reler', evidence: 'Roediger & Karpicke (2006); Karpicke & Blunt (2011)', how: 'Registo do bloco e testes de controlo; o plano propõe atividades ativas.' },
  { rule: 'Espaçar até ao exame', evidence: 'Ebbinghaus (1885); Cepeda et al. (2006, 2008)', how: 'Cada disciplina em vários dias; véspera só de revisão; semana final com prioridade.' },
  { rule: 'Intercalar', evidence: 'Rohrer & Taylor (2007)', how: 'Exercícios mistos e revisões cruzadas no plano.' },
  { rule: 'Desconfiar da fluência', evidence: 'Bjork (1994); Dunlosky et al. (2013)', how: 'Confiança vs. acertos; reler/sublinhar/resumir não são modo de estudo.' },
  { rule: 'IA depois de tentares', evidence: 'Bastani et al.', how: 'A IA organiza o plano e nunca resolve exercícios; prática com ajuda nunca conta para o domínio.' },
]

const comparison = [
  { feature: 'Timer de foco (Pomodoro)', es: true, pomo: true, anki: false, notion: 'part' },
  { feature: 'Plano semanal por disciplina', es: true, pomo: false, anki: false, notion: true },
  { feature: 'Plano gerado com regras de evidência', es: true, pomo: false, anki: false, notion: false },
  { feature: 'Repetição espaçada de cartões', es: false, pomo: false, anki: true, notion: false },
  { feature: 'Domínio medido sem ajuda', es: true, pomo: false, anki: 'part', notion: false },
  { feature: 'Confiança vs. acertos (calibração)', es: true, pomo: false, anki: false, notion: false },
  { feature: 'Provas, épocas e recurso', es: true, pomo: false, anki: false, notion: 'part' },
  { feature: 'Média por ECTS e objetivo', es: true, pomo: false, anki: false, notion: 'part' },
  { feature: 'Sincronização telemóvel ↔ PC', es: true, pomo: 'part', anki: true, notion: true },
  { feature: 'Funciona offline (PWA)', es: true, pomo: 'part', anki: true, notion: 'part' },
  { feature: 'Os teus dados, o teu servidor', es: true, pomo: false, anki: 'part', notion: false },
  { feature: 'Open source', es: 'mit', pomo: 'part', anki: true, notion: false },
]
const cell = (v: boolean | string) => (v === true ? '✅' : v === false ? '—' : v === 'mit' ? '✅ MIT' : '◐')
</script>

<template>
  <div class="home">
    <!-- HERO -->
    <section class="hero">
      <div class="hero-copy">
        <a :href="withBase('/changelog')" class="pill">✨ v1.0 — percurso académico, testes de controlo e configuração na app →</a>
        <h1 class="title">Estudar</h1>
        <p class="subtitle">Estuda para lembrar no dia do exame — não só no dia em que estudas.</p>
        <p class="tagline">Um sistema de estudo open source que segue o que a investigação sobre aprendizagem mostra que funciona, e mede o que sabes <strong>sem ajuda</strong>.</p>
        <div class="actions">
          <a :href="withBase('/guia/comecar')" class="btn brand">Começar</a>
          <a :href="REPO" class="btn alt" target="_blank" rel="noopener">Ver no GitHub</a>
        </div>
        <button class="install" @click="copyInstall" :title="copied ? 'Copiado!' : 'Copiar'">
          <code>git clone … &amp;&amp; npm install &amp;&amp; npm start</code>
          <span>{{ copied ? '✓ copiado' : 'copiar' }}</span>
        </button>
        <div class="links">
          <a :href="withBase('/guia/instalacao')">Instalação</a><span>·</span>
          <a :href="withBase('/ciencia/')">A ciência</a><span>·</span>
          <a :href="withBase('/arquitetura/')">Arquitetura</a><span>·</span>
          <a :href="REPO" target="_blank" rel="noopener">GitHub</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="glow" aria-hidden="true"></div>
        <img class="desktop" :src="withBase('/screenshots/hoje-desktop.png')" alt="Estudar no computador: o separador Hoje com a sessão seguinte e o aviso de exame" width="1280" height="800" />
        <img class="phone" :src="withBase('/screenshots/progresso.png')" alt="Estudar no telemóvel: domínio sem ajuda por disciplina" width="390" height="844" />
      </div>
    </section>

    <!-- FEATURES -->
    <section class="features">
      <div class="container grid">
        <a v-for="f in features" :key="f.title" :href="withBase(f.link)" class="feature">
          <div class="icon" aria-hidden="true">
            <svg v-if="f.icon === 'plan'" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17h6"/></svg>
            <svg v-else-if="f.icon === 'focus'" viewBox="0 0 24 24"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.5"/></svg>
            <svg v-else-if="f.icon === 'target'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>
            <svg v-else-if="f.icon === 'gauge'" viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/></svg>
            <svg v-else-if="f.icon === 'cap'" viewBox="0 0 24 24"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M7 18a5 5 0 0 1-.5-9.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/></svg>
          </div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </a>
      </div>
    </section>

    <!-- PROBLEM -->
    <section class="section">
      <div class="container narrow">
        <h2>O problema</h2>
        <p>A maioria das ferramentas de estudo mede o que é fácil de medir: <strong>horas, sessões, dias seguidos</strong>. Mas a investigação mostra que o desempenho durante o estudo é um mau sinal de aprendizagem:</p>
        <ul>
          <li>Reler dá mais sensação de domínio do que testar-te — e rende menos uma semana depois (Roediger &amp; Karpicke, 2006).</li>
          <li>Praticar um tipo de problema de cada vez dá melhores resultados no treino e muito piores no teste (Rohrer &amp; Taylor, 2007).</li>
          <li>Com um tutor de IA que dá respostas, o desempenho com ajuda sobe e o desempenho sem ajuda cai (Bastani et al.).</li>
        </ul>
        <p>E no ensino superior há mais: provas com pesos e mínimos, recurso, ECTS, uma média para manter — que nenhuma app de Pomodoro conhece.</p>
      </div>
    </section>

    <!-- SOLUTION -->
    <section class="section alt">
      <div class="container narrow">
        <h2>A solução</h2>
        <p>O Estudar organiza a semana e guia cada sessão, mas mede a aprendizagem pela <strong>recuperação sem ajuda, com atraso</strong>: testes de controlo em papel, feitos dias depois de estudares. Tudo o resto — tempo, prática com IA ou apontamentos — aparece à parte e nunca aumenta o teu domínio.</p>
        <img :src="withBase('/architecture.svg')" alt="Arquitetura: PWA no browser, Cloudflare Worker com a API e os segredos, Supabase para contas e dados, e o fornecedor de IA" class="arch" />
        <p>A app é uma PWA sem build. Um único Cloudflare Worker serve a app e a API (com as chaves como segredos), o Supabase guarda contas e dados com regras por utilizador, e a IA é a que escolheres. Alojar custa zero nos níveis gratuitos.</p>
      </div>
    </section>

    <!-- A DAY -->
    <section class="section">
      <div class="container">
        <h2 class="center">Um dia com o Estudar</h2>
        <div class="day">
          <div v-for="d in day" :key="d.title" class="day-step">
            <img :src="withBase(d.img)" :alt="d.title" loading="lazy" />
            <h3>{{ d.title }}</h3>
            <p>{{ d.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- SCIENCE -->
    <section class="section alt">
      <div class="container narrow">
        <h2>A ciência por trás</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Princípio</th><th>Evidência</th><th>No Estudar</th></tr></thead>
            <tbody>
              <tr v-for="s in science" :key="s.rule"><td><strong>{{ s.rule }}</strong></td><td>{{ s.evidence }}</td><td>{{ s.how }}</td></tr>
            </tbody>
          </table>
        </div>
        <p class="note">A evidência apoia os princípios; o plano concreto é sempre verificado por regras fixas e ajustado com os teus próprios resultados. <a :href="withBase('/ciencia/')">Ver os princípios R1–R9 e o que está implementado →</a></p>
      </div>
    </section>

    <!-- QUICK START -->
    <section class="section">
      <div class="container narrow">
        <h2>Início rápido</h2>
        <h3>1. Corre no teu computador</h3>
        <div class="code"><pre><code>git clone https://github.com/RyanTech00/estudar.git
cd estudar
npm install
npm start          # abre http://localhost:8787</code></pre></div>
        <p>Sem mais nada, a app já funciona em modo local (dados só no browser).</p>
        <h3>2. Liga o Supabase e a IA — dentro da app</h3>
        <p>Em <strong>Conta → Servidor e chaves</strong> colas o URL do Supabase e a chave da IA (o Gemini tem nível gratuito). Um botão cria as tabelas; o painel de estado fica verde.</p>
        <h3>3. Publica no Cloudflare</h3>
        <p><strong>Ligar conta Cloudflare → Publicar</strong>. A app fica em <code>https://estudar.&lt;a-tua-conta&gt;.workers.dev</code>, instalável no telemóvel. <a :href="withBase('/guia/instalacao')">Guia completo →</a></p>
      </div>
    </section>

    <!-- COMPARISON -->
    <section class="section alt">
      <div class="container narrow">
        <h2>Comparação</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Funcionalidade</th><th>Estudar</th><th>Apps de Pomodoro</th><th>Anki</th><th>Modelos Notion</th></tr></thead>
            <tbody>
              <tr v-for="r in comparison" :key="r.feature">
                <td>{{ r.feature }}</td><td>{{ cell(r.es) }}</td><td>{{ cell(r.pomo) }}</td><td>{{ cell(r.anki) }}</td><td>{{ cell(r.notion) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">◐ = parcial ou depende da app/modelo. O Anki é excelente para cartões de memória e complementa o Estudar: um organiza a semana e mede o domínio por disciplina, o outro agenda revisões de cartões.</p>
      </div>
    </section>

    <!-- SUPPORT -->
    <section class="section">
      <div class="container narrow center">
        <h2>Contribuir</h2>
        <p>O Estudar é open source (MIT). Se te ajudou a estudar melhor, deixa uma ⭐ no repositório para outros o encontrarem, ou abre uma issue com o que falta.</p>
        <div class="actions centered">
          <a :href="REPO" class="btn brand" target="_blank" rel="noopener">⭐ Dar uma estrela</a>
          <a :href="`${REPO}/issues`" class="btn alt" target="_blank" rel="noopener">Abrir uma issue</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home { --accent: var(--vp-c-brand-1); }
.container { max-width: 1152px; margin: 0 auto; padding: 0 24px; }
.container.narrow { max-width: 860px; }
.center { text-align: center; }

.hero {
  max-width: 1200px; margin: 0 auto; padding: 72px 24px 48px;
  display: grid; grid-template-columns: 1fr; gap: 48px; align-items: center;
}
@media (min-width: 960px) { .hero { grid-template-columns: 1fr 1.15fr; padding-top: 96px; } }
.hero > * { min-width: 0; }
.pill {
  display: inline-block; font-size: 13px; line-height: 1.5; padding: 6px 14px; border-radius: 16px; max-width: 100%;
  border: 1px solid var(--vp-c-border); background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); text-decoration: none;
}
.pill:hover { border-color: var(--accent); color: var(--vp-c-text-1); }
.title {
  font-family: 'Fira Code', monospace; font-size: clamp(48px, 9vw, 76px); font-weight: 700; letter-spacing: -0.04em; line-height: 1;
  margin: 22px 0 14px; color: var(--accent);
}
.subtitle { font-size: clamp(20px, 3vw, 26px); font-weight: 600; line-height: 1.3; color: var(--vp-c-text-1); margin: 0 0 14px; }
.tagline { font-size: 17px; color: var(--vp-c-text-2); line-height: 1.6; margin: 0 0 28px; max-width: 540px; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }
.actions.centered { justify-content: center; }
.btn { display: inline-flex; align-items: center; padding: 12px 22px; border-radius: 99px; font-weight: 600; text-decoration: none; transition: transform .12s, background .15s; }
.btn:active { transform: scale(.97); }
.btn.brand { background: #cfe86a; color: #151809; }
.btn.brand:hover { background: #dcf07f; }
.btn.alt { border: 1px solid var(--vp-c-border); color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); }
.btn.alt:hover { border-color: var(--accent); }
.install {
  margin-top: 22px; display: flex; align-items: center; gap: 14px; max-width: 100%;
  padding: 10px 14px; border-radius: 10px; border: 1px solid var(--vp-c-border); background: var(--vp-c-bg-alt); cursor: pointer; text-align: left;
}
.install code { font-size: 13px; background: none; padding: 0; color: var(--vp-c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.install span { font-size: 12px; color: var(--vp-c-text-3); flex-shrink: 0; }
.links { margin-top: 16px; font-size: 14px; color: var(--vp-c-text-3); display: flex; gap: 8px; flex-wrap: wrap; }
.links a { color: var(--vp-c-text-2); text-decoration: none; }
.links a:hover { color: var(--accent); }

.hero-visual { position: relative; min-height: 260px; }
.glow {
  position: absolute; inset: 10% 5%; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(207, 232, 106, .22), transparent); filter: blur(40px);
}
.hero-visual .desktop { position: relative; width: 100%; border-radius: 14px; border: 1px solid var(--vp-c-border); box-shadow: 0 24px 80px rgba(0,0,0,.5); }
.hero-visual .phone {
  position: absolute; right: -8px; bottom: -36px; width: 28%; min-width: 120px;
  border-radius: 22px; border: 1px solid var(--vp-c-border); box-shadow: 0 24px 60px rgba(0,0,0,.6);
}

.features { padding: 56px 0 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
.feature {
  display: block; padding: 22px; border-radius: 14px; border: 1px solid var(--vp-c-border); background: var(--vp-c-bg-soft);
  text-decoration: none; color: inherit; transition: border-color .2s, transform .2s;
}
.feature:hover { border-color: var(--accent); transform: translateY(-2px); }
.feature .icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--vp-c-brand-soft); color: var(--accent); margin-bottom: 14px; }
.feature svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.feature h3 { font-family: 'Fira Code', monospace; font-size: 16px; margin: 0 0 8px; color: var(--vp-c-text-1); }
.feature p { font-size: 14px; line-height: 1.6; color: var(--vp-c-text-2); margin: 0; }

.section { padding: 64px 0; }
.section.alt { background: var(--vp-c-bg-alt); border-top: 1px solid var(--vp-c-divider); border-bottom: 1px solid var(--vp-c-divider); }
.section h2 { font-family: 'Fira Code', monospace; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 18px; color: var(--vp-c-text-1); border: 0; padding: 0; }
.section h3 { font-family: 'Fira Code', monospace; font-size: 18px; margin: 28px 0 10px; color: var(--vp-c-text-1); }
.section p, .section li { font-size: 16px; line-height: 1.7; color: var(--vp-c-text-2); }
.section ul { padding-left: 20px; }
.section a { color: var(--accent); }
.arch { width: 100%; margin: 20px 0; border-radius: 12px; }
.note { font-size: 14px !important; color: var(--vp-c-text-3) !important; margin-top: 14px; }

.day { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 28px; }
.day-step img { width: 100%; border-radius: 18px; border: 1px solid var(--vp-c-border); box-shadow: 0 12px 40px rgba(0,0,0,.35); }
.day-step h3 { margin: 16px 0 6px; font-size: 16px; }
.day-step p { font-size: 14px; margin: 0; }

.table-wrap { overflow-x: auto; margin-top: 12px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--vp-c-divider); vertical-align: top; color: var(--vp-c-text-2); }
th { color: var(--vp-c-text-1); font-weight: 600; white-space: nowrap; }
td:not(:first-child) { white-space: nowrap; }
table:has(th:nth-child(3):last-child) td { white-space: normal; }

.code { margin: 12px 0; border-radius: 10px; background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-border); overflow-x: auto; }
.code pre { margin: 0; padding: 16px 18px; }
.code code { font-size: 13px; line-height: 1.7; background: none; color: var(--vp-c-text-1); }
</style>
