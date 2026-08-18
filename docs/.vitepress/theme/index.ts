import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import ImageViewerP from '@miletorix/vitepress-image-viewer'
import AppIcon from './components/AppIcon.vue'
import VersionBadge from './components/VersionBadge.vue'
import '@miletorix/vitepress-image-viewer/style.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(VersionBadge)
    }),
  enhanceApp({ app }) {
    app.component('AppIcon', AppIcon)
    ImageViewerP(app, {
      autoShowThumbnails: false,
      transparentBg: true
    })
  }
}
