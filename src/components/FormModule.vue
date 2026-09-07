<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { NCollapse, NCollapseItem } from 'naive-ui'
import ConfigField from './ConfigField.vue'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const defaultExpanded = computed(() => props.module.sections?.filter((section) => section.defaultOpen).map((section) => section.id) ?? [])
</script>

<template>
  <div class="module-content">
    <header class="module-heading"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div></header>
    <NCollapse class="schema-collapse" :default-expanded-names="defaultExpanded" display-directive="show">
      <NCollapseItem v-for="section in module.sections" :key="section.id" :name="section.id" :title="section.title">
        <template v-if="section.description" #header-extra><span class="section-description">{{ section.description }}</span></template>
        <div class="section-fields">
          <ConfigField v-for="field in section.fields" :key="field.path" :field="field" :model-value="store.get(field.path)" @update:model-value="store.set(field.path, $event)" />
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>
