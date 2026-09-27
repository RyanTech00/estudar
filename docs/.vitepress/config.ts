import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/RyanTech00/estudar'

export default defineConfig({
  title: 'Estudar',
  description: 'Sistema de estudo open source baseado em ciência da aprendizagem: plano semanal com IA, modo foco, testes de controlo e percurso académico.',
  lang: 'pt-PT',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap', rel: 'stylesheet' }],
    ['meta', { name: 'theme-color', content: '#0d0e10' }],
    ['meta', { property: 'og:title', content: 'Estudar — estuda para lembrar no dia do exame' }],
    ['meta', { property: 'og:description', content: 'Plano semanal com IA, modo foco, testes de controlo sem consulta e percurso académico. Open source, grátis de alojar.' }],
    ['meta', { property: 'og:image', content: '/screenshots/hoje-desktop.png' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Estudar',

    nav: [
      { text: 'Guia', link: '/guia/comecar' },
      { text: 'Funcionalidades', link: '/funcionalidades/' },
      { text: 'Ciência', link: '/ciencia/' },
      { text: 'Arquitetura', link: '/arquitetura/' },
      { text: 'Roadmap', link: '/roadmap' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: {
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
    },

    socialLinks: [{ icon: 'github', link: REPO }],

    footer: {
      message: 'Publicado sob a licença MIT.',
      copyright: 'Copyright © 2026 Ryan Barbosa',
    },

    search: {
      provider: 'local',
      options: {
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

    editLink: {
      pattern: `${REPO}/edit/main/docs/:path`,
      text: 'Editar esta página no GitHub',
    },

    outline: { label: 'Nesta página', level: [2, 3] },
    docFooter: { prev: 'Anterior', next: 'Seguinte' },
    lastUpdated: { text: 'Atualizado' },
    returnToTopLabel: 'Voltar ao topo',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Tema',
    notFound: { title: 'Página não encontrada', quote: 'Esta página não existe — mas podes testar-te sobre as que existem.', linkText: 'Voltar ao início' },
  },
})
