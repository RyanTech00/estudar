import type { Theme } from 'vitepress'
import { inBrowser } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomePage from './components/HomePage.vue'
import Shot from './components/Shot.vue'
import { fixLocalePath } from './locale-paths'
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
