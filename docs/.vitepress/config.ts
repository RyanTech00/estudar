import { defineConfig, type DefaultTheme } from 'vitepress'

const REPO = 'https://github.com/RyanTech00/estudar'
const BMC = 'https://buymeacoffee.com/ryanbarbosa'
const SITE = 'https://estudar.ryanbarbosa.com'

// ── Portuguese (root) ────────────────────────────────────────────
const ptNav: DefaultTheme.NavItem[] = [
  { text: 'Guia', link: '/guia/comecar', activeMatch: '^/guia/' },
  { text: 'Funcionalidades', link: '/funcionalidades/', activeMatch: '^/funcionalidades/' },
  { text: 'Ciência', link: '/ciencia/', activeMatch: '^/ciencia/' },
  { text: 'Arquitetura', link: '/arquitetura/', activeMatch: '^/arquitetura/' },
  {
    text: 'Mais',
    items: [
      { text: 'Roadmap', link: '/roadmap' },
      { text: 'Changelog', link: '/changelog' },
      { text: '☕ Buy Me a Coffee', link: BMC },
    ],
  },
]

const ptSidebar: DefaultTheme.Sidebar = {
  '/guia/': [
    {
      text: 'Introdução',
      items: [
        { text: 'Começar', link: '/guia/comecar' },
        { text: 'Instalação', link: '/guia/instalacao' },
        { text: 'Servidor e chaves', link: '/guia/configuracao' },
      ],
    },
    {
      text: 'Uso',
      items: [
        { text: 'O primeiro plano', link: '/guia/primeiro-plano' },
        { text: 'O dia a dia', link: '/guia/dia-a-dia' },
        { text: 'Privacidade e segurança', link: '/guia/seguranca' },
        { text: 'Perguntas frequentes', link: '/guia/faq' },
      ],
    },
  ],
  '/funcionalidades/': [
    {
      text: 'Funcionalidades',
      items: [
        { text: 'Visão geral', link: '/funcionalidades/' },
        { text: 'Plano semanal com IA', link: '/funcionalidades/plano-com-ia' },
        { text: 'Timer e modo foco', link: '/funcionalidades/timer-e-foco' },
        { text: 'Registo do bloco', link: '/funcionalidades/registo-do-bloco' },
        { text: 'Testes de controlo e domínio', link: '/funcionalidades/testes-de-controlo' },
        { text: 'Percurso académico', link: '/funcionalidades/percurso' },
        { text: 'Relatório de semestre', link: '/funcionalidades/relatorio-de-semestre' },
        { text: 'Sincronização e offline', link: '/funcionalidades/sincronizacao' },
      ],
    },
  ],
  '/ciencia/': [
    {
      text: 'Ciência da aprendizagem',
      items: [
        { text: 'Princípios (R1–R9)', link: '/ciencia/' },
        { text: 'Referências', link: '/ciencia/referencias' },
      ],
    },
  ],
  '/arquitetura/': [
    {
      text: 'Arquitetura',
      items: [
        { text: 'Visão geral', link: '/arquitetura/' },
        { text: 'Modelo de dados', link: '/arquitetura/dados' },
        { text: 'API', link: '/arquitetura/api' },
        { text: 'Testes', link: '/arquitetura/testes' },
      ],
    },
  ],
}

// ── English (/en/) ───────────────────────────────────────────────
const enNav: DefaultTheme.NavItem[] = [
  { text: 'Guide', link: '/en/guide/getting-started', activeMatch: '^/en/guide/' },
  { text: 'Features', link: '/en/features/', activeMatch: '^/en/features/' },
  { text: 'Science', link: '/en/science/', activeMatch: '^/en/science/' },
  { text: 'Architecture', link: '/en/architecture/', activeMatch: '^/en/architecture/' },
  {
    text: 'More',
    items: [
      { text: 'Roadmap', link: '/en/roadmap' },
      { text: 'Changelog', link: '/en/changelog' },
      { text: '☕ Buy Me a Coffee', link: BMC },
    ],
  },
]

const enSidebar: DefaultTheme.Sidebar = {
  '/en/guide/': [
    {
      text: 'Introduction',
      items: [
        { text: 'Getting started', link: '/en/guide/getting-started' },
        { text: 'Installation', link: '/en/guide/installation' },
        { text: 'Server & keys', link: '/en/guide/configuration' },
      ],
    },
    {
      text: 'Using it',
      items: [
        { text: 'Your first plan', link: '/en/guide/first-plan' },
        { text: 'Day to day', link: '/en/guide/day-to-day' },
        { text: 'Privacy and security', link: '/en/guide/security' },
        { text: 'FAQ', link: '/en/guide/faq' },
      ],
    },
  ],
  '/en/features/': [
    {
      text: 'Features',
      items: [
        { text: 'Overview', link: '/en/features/' },
        { text: 'AI weekly plan', link: '/en/features/ai-plan' },
        { text: 'Timer and focus mode', link: '/en/features/timer-and-focus' },
        { text: 'Block log', link: '/en/features/block-log' },
        { text: 'Closed-book tests and mastery', link: '/en/features/closed-book-tests' },
        { text: 'Degree record', link: '/en/features/degree-record' },
        { text: 'Semester report', link: '/en/features/semester-report' },
        { text: 'Sync and offline', link: '/en/features/sync' },
      ],
    },
  ],
  '/en/science/': [
    {
      text: 'Learning science',
      items: [
        { text: 'Principles (R1–R9)', link: '/en/science/' },
        { text: 'References', link: '/en/science/references' },
      ],
    },
  ],
  '/en/architecture/': [
    {
      text: 'Architecture',
      items: [
        { text: 'Overview', link: '/en/architecture/' },
        { text: 'Data model', link: '/en/architecture/data' },
        { text: 'API', link: '/en/architecture/api' },
        { text: 'Tests', link: '/en/architecture/tests' },
      ],
    },
  ],
}

export default defineConfig({
  title: 'Estudar',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',
  sitemap: { hostname: SITE },

  locales: {
    root: {
      label: 'Português',
      lang: 'pt-PT',
      description: 'Sistema de estudo open source baseado em ciência da aprendizagem: plano semanal com IA, modo foco, testes de controlo e percurso académico.',
      themeConfig: {
        nav: ptNav,
        sidebar: ptSidebar,
        editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Editar esta página no GitHub' },
        footer: { message: 'Publicado sob a licença MIT.', copyright: 'Copyright © 2026 Ryan Barbosa' },
        outline: { label: 'Nesta página', level: [2, 3] },
        docFooter: { prev: 'Anterior', next: 'Seguinte' },
        lastUpdated: { text: 'Atualizado' },
        returnToTopLabel: 'Voltar ao topo',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Tema',
        langMenuLabel: 'Mudar idioma',
        notFound: { title: 'Página não encontrada', quote: 'Esta página não existe — mas podes testar-te sobre as que existem.', linkText: 'Voltar ao início' },
      },
    },
    en: {
      label: 'English',
      lang: 'en-GB',
      link: '/en/',
      description: 'Open-source study system built on learning science: AI weekly plan, focus mode, closed-book tests and a degree record.',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
        footer: { message: 'Released under the MIT licence.', copyright: 'Copyright © 2026 Ryan Barbosa' },
        outline: { label: 'On this page', level: [2, 3] },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Updated' },
        returnToTopLabel: 'Back to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Theme',
        langMenuLabel: 'Change language',
        notFound: { title: 'Page not found', quote: "This page doesn't exist — but you can test yourself on the ones that do.", linkText: 'Back home' },
      },
    },
  },

  head: [
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#0d0e10' }],
    ['meta', { property: 'og:title', content: 'Estudar — estuda para lembrar no dia do exame' }],
    ['meta', { property: 'og:description', content: 'Plano semanal com IA, modo foco, testes de controlo sem consulta e percurso académico. Open source, grátis de alojar.' }],
    ['meta', { property: 'og:image', content: `${SITE}/screenshots/hoje-desktop.png` }],
    ['meta', { property: 'og:url', content: SITE }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Estudar',
    socialLinks: [{ icon: 'github', link: REPO }],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: 'Pesquisar', buttonAriaLabel: 'Pesquisar' },
              modal: {
                noResultsText: 'Sem resultados para',
                resetButtonTitle: 'Limpar',
                footer: { selectText: 'escolher', navigateText: 'navegar', closeText: 'fechar' },
              },
            },
          },
        },
      },
    },
  },
})
