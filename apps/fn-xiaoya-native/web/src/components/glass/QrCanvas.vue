<!--
  二维码渲染。

  直接使用脚手架已有的 `qrcode.vue`，不自己实现编码器：
  二维码涉及纠错分块、掩码选择与格式信息，手写版本很难保证所有内容都能被扫出来，
  而授权流程完全依赖这一步可用。库已经在依赖里，不引入新的供应链成本。
-->
<template>
  <div class="qr">
    <QrcodeVue :value="content" :size="size" level="M" render-as="canvas" />
  </div>
</template>

<script setup lang="ts">
  import QrcodeVue from 'qrcode.vue'

  withDefaults(defineProps<{ content: string; size?: number }>(), { size: 180 })
</script>

<style lang="scss" scoped>
  .qr {
    display: inline-flex;
    padding: 8px;
    background: #fff;
    border-radius: 10px;

    :deep(canvas) {
      display: block;
      border-radius: 6px;
    }
  }
</style>
