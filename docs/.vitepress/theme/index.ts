import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomePage from './components/HomePage.vue'
import Shot from './components/Shot.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage)
    app.component('Shot', Shot)
  },
} satisfies Theme
