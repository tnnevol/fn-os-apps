<script setup lang="ts">
interface FlowStep {
  label: string
  detail?: string
  variant?: 'default' | 'primary' | 'success' | 'warning'
  children?: FlowStep[]
}

const props = withDefaults(
  defineProps<{
    steps: FlowStep[]
    columns?: number
  }>(),
  {
    columns: 0
  }
)

const variantClass = (variant: FlowStep['variant']): string => {
  switch (variant) {
    case 'primary':
      return 'flow-step--primary'
    case 'success':
      return 'flow-step--success'
    case 'warning':
      return 'flow-step--warning'
    default:
      return ''
  }
}
</script>

<template>
  <div class="flow-grid" :style="props.columns ? { '--flow-columns': props.columns } : undefined">
    <template v-for="(step, index) in props.steps" :key="index">
      <div class="flow-step" :class="variantClass(step.variant)">
        <div class="flow-step__label">{{ step.label }}</div>
        <div v-if="step.detail" class="flow-step__detail">{{ step.detail }}</div>
        <div v-if="step.children && step.children.length > 0" class="flow-step__children">
          <div
            v-for="(child, childIndex) in step.children"
            :key="childIndex"
            class="flow-step flow-step--child"
            :class="variantClass(child.variant)"
          >
            <div class="flow-step__label">{{ child.label }}</div>
            <div v-if="child.detail" class="flow-step__detail">{{ child.detail }}</div>
          </div>
        </div>
      </div>
      <div v-if="index < props.steps.length - 1" class="flow-arrow" aria-hidden="true">↓</div>
    </template>
  </div>
</template>

<style scoped>
.flow-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin: 16px 0 24px;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--docs-gradient-soft);
}

.flow-step {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-elv);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.06);
  transition: transform 0.2s var(--docs-ease), box-shadow 0.2s var(--docs-ease);
}

.flow-step:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.12);
}

.flow-step__label {
  font-weight: 650;
  color: var(--vp-c-text-1);
  font-size: 14px;
}

.flow-step__detail {
  font-size: 12px;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.flow-step--primary {
  border-color: var(--vp-c-brand-1);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.08), rgba(59, 130, 246, 0.08));
}

.flow-step--primary .flow-step__label {
  color: var(--vp-c-brand-2);
}

.flow-step--success {
  border-color: rgba(34, 197, 94, 0.4);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(16, 185, 129, 0.06));
}

.flow-step--success .flow-step__label {
  color: rgb(22, 163, 74);
}

.flow-step--warning {
  border-color: rgba(245, 158, 11, 0.4);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(217, 119, 6, 0.06));
}

.flow-step--warning .flow-step__label {
  color: rgb(180, 83, 9);
}

.flow-step__children {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px dashed var(--vp-c-divider);
}

.flow-step--child {
  padding: 8px 12px;
  font-size: 13px;
}

.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: var(--vp-c-brand-2);
  font-weight: 700;
  height: 24px;
}

@media (min-width: 768px) {
  .flow-grid {
    grid-template-columns: repeat(var(--flow-columns, 3), 1fr);
    gap: 16px;
  }

  .flow-arrow {
    display: none;
  }

  .flow-grid > .flow-step:not(:last-child)::after {
    content: '→';
    position: absolute;
    right: -12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--vp-c-brand-2);
    font-size: 18px;
    font-weight: 700;
  }

  .flow-grid > .flow-step {
    position: relative;
  }
}
</style>
