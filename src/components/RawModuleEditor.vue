<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ExternalLink } from '@lucide/vue'
import { parse, stringify } from 'yaml'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const source = ref('')
const error = ref('')
const expected = computed(() => props.module.kind === 'raw-list' ? '数组' : '对象')

function sync() {
  const value = store.get(props.module.rootKey!)
  source.value = value === undefined ? '' : stringify(value, { lineWidth: 0, indent: 2 })
  error.value = ''
}

function apply() {
  try {
    if (!source.value.trim()) { store.setRoot(props.module.rootKey!, undefined); error.value = ''; return }
    const value = parse(source.value) as unknown
    if (props.module.kind === 'raw-list' && !Array.isArray(value)) throw new Error(`此模块的内容必须是 YAML ${expected.value}`)
    if (props.module.kind !== 'raw-list' && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error(`此模块的内容必须是 YAML ${expected.value}`)
    store.setRoot(props.module.rootKey!, value)
    error.value = ''
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法解析 YAML 片段' }
}

watch(() => props.module.id, sync, { immediate: true })
</script>

<template>
  <div class="module-content">
    <header class="module-heading"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div></header>
    <section class="editor-card fragment-card">
      <div class="fragment-head"><div><strong>{{ module.rootKey }}</strong><span>请输入 YAML {{ expected }}片段，不需要填写顶层键名</span></div><button class="primary-button" @click="apply"><Check :size="15" />应用片段</button></div>
      <textarea v-model="source" class="fragment-editor" spellcheck="false" :placeholder="module.kind === 'raw-list' ? '- name: example\n  type: mixed\n  port: 7893' : 'example:\n  type: http\n  url: https://example.com/list.yaml'" />
      <p v-if="error" class="inline-error">{{ error }}</p>
    </section>
  </div>
</template>
