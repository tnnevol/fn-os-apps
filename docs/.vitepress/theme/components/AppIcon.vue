<script setup lang="ts">
import { withBase } from 'vitepress'

const props = withDefaults(
  defineProps<{
    name: string
    alt: string
    size?: number
  }>(),
  {
    size: 96
  }
)

const iconSrc = withBase(`/icons/${props.name}.png`)
</script>

<template>
  <img :src="iconSrc" :alt="props.alt" :width="props.size" :height="props.size">
</template>
