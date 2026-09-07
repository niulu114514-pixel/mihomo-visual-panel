<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, GripVertical, Plus, Search, Trash2 } from '@lucide/vue'
import { NButton, NInput, NPopconfirm, useMessage } from 'naive-ui'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const query = ref('')
const draft = ref('')
const rules = computed(() => Array.isArray(store.get(props.module.rootKey!)) ? store.get(props.module.rootKey!) as unknown[] : [])
const shown = computed(() => rules.value.map((value, index) => ({ value: String(value), index })).filter((item) => item.value.toLowerCase().includes(query.value.toLowerCase())))

function add() {
  const values = draft.value.split('\n').map((value) => value.trim()).filter(Boolean)
  if (!values.length) return
  store.setRoot(props.module.rootKey!, [...rules.value, ...values])
  draft.value = ''
  message.success(`已添加 ${values.length} 条规则`)
}

function update(index: number, value: string) { const next = [...rules.value]; next[index] = value; store.setRoot(props.module.rootKey!, next) }
function remove(index: number) { store.setRoot(props.module.rootKey!, rules.value.filter((_, itemIndex) => itemIndex !== index)) }
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div><NInput v-model:value="query" clearable placeholder="搜索规则" class="collection-search"><template #prefix><Search :size="15" /></template></NInput></header>
    <section class="editor-card add-rule"><NInput v-model:value="draft" type="textarea" placeholder="每行一条规则，例如：DOMAIN-SUFFIX,google.com,节点选择" :autosize="{ minRows: 2, maxRows: 6 }" /><NButton type="primary" @click="add"><template #icon><Plus :size="15" /></template>添加规则</NButton></section>
    <section class="editor-card list-card">
      <div class="list-header"><strong>规则列表</strong><span>{{ rules.length }} 条</span></div>
      <div v-if="shown.length" class="editable-list"><div v-for="item in shown" :key="item.index" class="editable-row"><GripVertical :size="15" /><span class="row-index">{{ item.index + 1 }}</span><NInput size="small" :value="item.value" @update:value="update(item.index, $event)" /><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(item.index)"><template #trigger><NButton quaternary circle size="tiny" title="删除"><template #icon><Trash2 :size="15" /></template></NButton></template>确定删除这条规则吗？</NPopconfirm></div></div>
      <div v-else class="empty-state">暂无规则</div>
    </section>
  </div>
</template>
