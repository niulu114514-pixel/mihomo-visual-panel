<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, GripVertical, Plus, Search, Trash2 } from '@lucide/vue'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const query = ref('')
const draft = ref('')
const rules = computed(() => Array.isArray(store.get(props.module.rootKey!)) ? store.get(props.module.rootKey!) as unknown[] : [])
const shown = computed(() => rules.value.map((value, index) => ({ value: String(value), index })).filter((item) => item.value.toLowerCase().includes(query.value.toLowerCase())))

function add() {
  const values = draft.value.split('\n').map((value) => value.trim()).filter(Boolean)
  if (!values.length) return
  store.setRoot(props.module.rootKey!, [...rules.value, ...values])
  draft.value = ''
}

function update(index: number, value: string) { const next = [...rules.value]; next[index] = value; store.setRoot(props.module.rootKey!, next) }
function remove(index: number) { store.setRoot(props.module.rootKey!, rules.value.filter((_, itemIndex) => itemIndex !== index)) }
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div><div class="search-box"><Search :size="15" /><input v-model="query" placeholder="搜索规则" /></div></header>
    <section class="editor-card add-rule"><textarea v-model="draft" placeholder="每行一条规则，例如：DOMAIN-SUFFIX,google.com,节点选择" /><button class="primary-button" @click="add"><Plus :size="15" />添加规则</button></section>
    <section class="editor-card list-card">
      <div class="list-header"><strong>规则列表</strong><span>{{ rules.length }} 条</span></div>
      <div v-if="shown.length" class="editable-list"><div v-for="item in shown" :key="item.index" class="editable-row"><GripVertical :size="15" /><span class="row-index">{{ item.index + 1 }}</span><input :value="item.value" @change="update(item.index, ($event.target as HTMLInputElement).value)" /><button title="删除" @click="remove(item.index)"><Trash2 :size="15" /></button></div></div>
      <div v-else class="empty-state">暂无规则</div>
    </section>
  </div>
</template>
