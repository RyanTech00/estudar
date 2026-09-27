import type { Theme } from 'vitepress'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomePage from './components/HomePage.vue'
import Shot from './components/Shot.vue'
import { fixLocalePath } from './locale-paths'
// Fonts served by the site itself: no request to Google (visitors' IPs stay private) and a stricter CSP.
import '@fontsource/fira-sans/latin-300.css'
import '@fontsource/fira-sans/latin-400.css'
import '@fontsource/fira-sans/latin-500.css'
import '@fontsource/fira-sans/latin-600.css'
import '@fontsource/fira-sans/latin-700.css'
import '@fontsource/fira-sans/latin-ext-400.css'
import '@fontsource/fira-code/latin-400.css'
import '@fontsource/fira-code/latin-500.css'
import '@fontsource/fira-code/latin-600.css'
import '@fontsource/fira-code/latin-700.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router }) {
    app.component('HomePage', HomePage)
    app.component('Shot', Shot)
    if (!inBrowser) return

    // Language switcher and old links: send /en/<pt-slug> and /<en-slug> to the real page.
    router.onBeforeRouteChange = (to) => {
      const url = new URL(to, location.origin)
      const fixed = fixLocalePath(url.pathname)
      if (!fixed) return
      router.go(fixed + url.hash)
      return false
    }
    const fixed = fixLocalePath(location.pathname)
    if (fixed) location.replace(fixed + location.hash)
  },
} satisfies Theme
