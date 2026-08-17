<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { theme } = useData()
const version = computed(() => (theme.value as { version?: string }).version)
</script>

<template>
  <a
    v-if="version"
    class="docs-version"
    href="https://github.com/tnnevol/fn-os-apps/releases"
    target="_blank"
    rel="noreferrer"
    :aria-label="`查看版本 ${version}`"
  >
    v{{ version }}
  </a>
</template>
