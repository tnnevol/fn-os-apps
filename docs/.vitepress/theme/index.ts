import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AppIcon from './components/AppIcon.vue'
import VersionBadge from './components/VersionBadge.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(VersionBadge)
    }),
  enhanceApp({ app }) {
    app.component('AppIcon', AppIcon)
  }
}
