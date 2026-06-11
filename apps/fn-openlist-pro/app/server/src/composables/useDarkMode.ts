import { watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export default function useDarkMode() {
  const prefersDark = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
  const isDark = useLocalStorage('dark-mode', prefersDark)

  watch(
    isDark,
    (val: boolean) => {
      if (val) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },
    { immediate: true },
  )

  const toggleDark = () => {
    isDark.value = !isDark.value
  }

  return { isDark, toggleDark }
}
