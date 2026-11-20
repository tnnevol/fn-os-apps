<!--
  内容卡片。

  按用户要求不自定义设计：直接复用脚手架自带的 `art-card` 视觉体系
  （`--default-box-color`、`--art-card-border`、`--custom-radius`），
  主题切换（浅色/深色/主色）由脚手架的 setting store 驱动，这里不覆盖。

  只额外加一层半透明与背景模糊，让卡片在背景上呈现毛玻璃层次；
  颜色一律取自框架变量，避免出现「自定义变量名根本不存在」导致的对比度问题。
-->
<template>
  <section class="glass-panel art-card">
    <header v-if="title || $slots.header" class="glass-panel__header">
      <div class="glass-panel__titles">
        <h3 v-if="title" class="glass-panel__title">{{ title }}</h3>
        <p v-if="description" class="glass-panel__desc">{{ description }}</p>
      </div>
      <div v-if="$slots.header" class="glass-panel__header-slot">
        <slot name="header"></slot>
      </div>
    </header>
    <div class="glass-panel__body">
      <slot></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
  defineOptions({ name: 'GlassPanel' })

  defineProps<{
    title?: string
    description?: string
  }>()
</script>

<style lang="scss" scoped>
  .glass-panel {
    display: flex;
    flex-direction: column;
    // 半透明 + 背景模糊：毛玻璃观感只体现在这一层，
    // 颜色与圆角全部沿用 art-card 的框架变量
    background: color-mix(in srgb, var(--default-box-color) 78%, transparent);

    @include backdropBlur();

    // 不用 `& + &` 定间距：相邻兄弟选择器依赖 DOM 上两个卡片紧挨着，
    // 一旦中间插入任何元素（提示条、过渡占位、v-if 留下的锚点），
    // 间距就会静默消失。改由页面容器用 flex gap 统一控制。

    &__header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px 20px 0;
    }

    &__titles {
      min-width: 0;
    }

    &__title {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    &__desc {
      margin: 4px 0 0;
      font-size: 12px;
      line-height: 1.6;
      color: var(--el-text-color-secondary);
    }

    &__header-slot {
      flex-shrink: 0;
    }

    &__body {
      padding: 16px 20px 20px;
    }
  }
</style>
