import { defineComponent, h, onMounted, onUpdated } from 'vue'
import DefaultTheme from 'vitepress/theme'
import ImageViewerP from '@miletorix/vitepress-image-viewer'
import AppIcon from './components/AppIcon.vue'
import VersionBadge from './components/VersionBadge.vue'
import '@miletorix/vitepress-image-viewer/style.css'
import './custom.css'

const markNonPreviewImages = () => {
  document
    .querySelectorAll<HTMLImageElement>('.VPNavBar img, .VPHero img')
    .forEach(image => image.classList.add('no-viewer'))
}

const DocsLayout = defineComponent({
  setup() {
    onMounted(markNonPreviewImages)
    onUpdated(markNonPreviewImages)

    return () =>
      h(DefaultTheme.Layout, null, {
        'nav-bar-content-after': () => h(VersionBadge)
      })
  }
})

export default {
  extends: DefaultTheme,
  Layout: DocsLayout,
  enhanceApp({ app }) {
    app.component('AppIcon', AppIcon)
    ImageViewerP(app, {
      autoShowThumbnails: false,
      transparentBg: true
    })
  }
}
