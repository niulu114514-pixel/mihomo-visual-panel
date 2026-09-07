<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ExternalLink } from '@lucide/vue'
import ConfigField from './ConfigField.vue'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const open = ref<Set<string>>(new Set())

function isOpen(id: string, defaultOpen = false) {
  return open.value.has(id) || (open.value.size === 0 && defaultOpen)
}

function toggle(id: string, defaultOpen = false) {
  const currentlyOpen = isOpen(id, defaultOpen)
  const next = new Set(open.value)
  if (currentlyOpen) next.delete(id)
  else next.add(id)
  if (defaultOpen && currentlyOpen && open.value.size === 0) next.add('__closed-default__')
  open.value = next
}
</script>

<template>
  <div class="module-content">
    <header class="module-heading"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div></header>
    <section v-for="section in module.sections" :key="section.id" class="form-section" :class="{ open: isOpen(section.id, section.defaultOpen) }">
      <button class="section-trigger" @click="toggle(section.id, section.defaultOpen)"><ChevronDown :size="17" /><strong>{{ section.title }}</strong><span>{{ section.description }}</span></button>
      <div v-if="isOpen(section.id, section.defaultOpen)" class="section-fields">
        <ConfigField v-for="field in section.fields" :key="field.path" :field="field" :model-value="store.get(field.path)" @update:model-value="store.set(field.path, $event)" />
      </div>
    </section>
  </div>
</template>
