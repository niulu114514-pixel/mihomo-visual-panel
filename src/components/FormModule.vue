<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { NCollapse, NCollapseItem } from 'naive-ui'
import ConfigField from './ConfigField.vue'
import VisualValueEditor from './VisualValueEditor.vue'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const expandedNames = ref<string[]>([])

watch(() => props.module.id, () => {
  expandedNames.value = props.module.sections?.map((section) => section.id) ?? []
}, { immediate: true })

function itemCount(key: string) {
  const value = store.get(key)
  if (Array.isArray(value)) return value.length
  return value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>).length : 0
}

const overviewItems = computed(() => [
  { label: '代理节点', count: itemCount('proxies'), to: '/mihomo/proxies' },
  { label: '代理组', count: itemCount('proxy-groups'), to: '/mihomo/groups' },
  { label: '代理集合', count: itemCount('proxy-providers'), to: '/mihomo/proxy-providers' },
  { label: '规则集合', count: itemCount('rule-providers'), to: '/mihomo/rule-providers' },
  { label: '路由规则', count: itemCount('rules'), to: '/mihomo/rules' },
])

const completeConfig = computed({
  get: () => store.config as Record<string, unknown>,
  set: (value: Record<string, unknown>) => store.replaceConfig(value),
})
</script>

<template>
  <div class="module-content">
    <header class="module-heading"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div></header>
    <section v-if="module.id === 'general'" class="config-overview" aria-label="当前配置概览">
      <div class="config-overview__copy"><strong>当前配置已读取</strong><span>{{ store.fileName }} · 点击下面的模块即可查看和编辑</span></div>
      <div class="config-overview__items">
        <RouterLink v-for="item in overviewItems" :key="item.label" :to="item.to"><strong>{{ item.count }}</strong><span>{{ item.label }}</span></RouterLink>
      </div>
    </section>
    <NCollapse v-model:expanded-names="expandedNames" class="schema-collapse" display-directive="show">
      <NCollapseItem v-for="section in module.sections" :key="section.id" :name="section.id" :title="section.title">
        <template v-if="section.description" #header-extra><span class="section-description">{{ section.description }}</span></template>
        <div class="section-fields">
          <ConfigField v-for="field in section.fields" :key="field.path" :field="field" :model-value="store.get(field.path)" @update:model-value="store.set(field.path, $event)" />
        </div>
      </NCollapseItem>
      <NCollapseItem v-if="module.id === 'general'" name="complete-config" title="完整配置树（所有字段）">
        <p class="complete-editor-note">可视化编辑当前配置中的任意顶层字段、嵌套对象和数组；协议专属与未来新增字段也不会遗漏。</p>
        <VisualValueEditor v-model="completeConfig" root />
      </NCollapseItem>
    </NCollapse>
  </div>
</template>
