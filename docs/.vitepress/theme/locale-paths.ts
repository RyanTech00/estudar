// Portuguese pages live at the root with Portuguese slugs; English pages under /en/ with English slugs.
// VitePress's language switcher keeps the slug and only swaps the prefix, so it would land on a 404
// (e.g. /en/features/ai-plan → /features/ai-plan). fixLocalePath() maps such paths to the real counterpart.
export const PT_TO_EN: Record<string, string> = {
  '/': '/en/',
  '/guia/comecar': '/en/guide/getting-started',
  '/guia/instalacao': '/en/guide/installation',
  '/guia/configuracao': '/en/guide/configuration',
  '/guia/primeiro-plano': '/en/guide/first-plan',
  '/guia/dia-a-dia': '/en/guide/day-to-day',
  '/guia/seguranca': '/en/guide/security',
  '/guia/faq': '/en/guide/faq',
  '/funcionalidades/': '/en/features/',
  '/funcionalidades/plano-com-ia': '/en/features/ai-plan',
  '/funcionalidades/timer-e-foco': '/en/features/timer-and-focus',
  '/funcionalidades/registo-do-bloco': '/en/features/block-log',
  '/funcionalidades/testes-de-controlo': '/en/features/closed-book-tests',
  '/funcionalidades/percurso': '/en/features/degree-record',
  '/funcionalidades/relatorio-de-semestre': '/en/features/semester-report',
  '/funcionalidades/sincronizacao': '/en/features/sync',
  '/ciencia/': '/en/science/',
  '/ciencia/referencias': '/en/science/references',
  '/arquitetura/': '/en/architecture/',
  '/arquitetura/dados': '/en/architecture/data',
  '/arquitetura/api': '/en/architecture/api',
  '/arquitetura/testes': '/en/architecture/tests',
  '/roadmap': '/en/roadmap',
  '/changelog': '/en/changelog',
}
const EN_TO_PT = Object.fromEntries(Object.entries(PT_TO_EN).map(([pt, en]) => [en, pt]))

const clean = (p: string) => p.replace(/\.html$/, '').replace(/\/index$/, '/')

/** The correct path when `path` is a slug in the wrong language for its prefix; otherwise null. */
export function fixLocalePath(path: string): string | null {
  const p = clean(path)
  if (p in PT_TO_EN || p in EN_TO_PT) return null
  const fixed = p.startsWith('/en/') ? PT_TO_EN[p.slice(3)] : EN_TO_PT[`/en${p}`]
  return fixed && fixed !== p ? fixed : null
}
