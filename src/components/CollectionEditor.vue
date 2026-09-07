<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ExternalLink, Plus, Search, Trash2 } from '@lucide/vue'
import { NButton, NForm, NFormItem, NInput, NInputNumber, NModal, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import { parse, stringify } from 'yaml'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const query = ref('')
const dialog = ref(false)
const editIndex = ref<number | null>(null)
const editSource = ref('')
const editError = ref('')
const draft = reactive({ name: '', type: props.module.kind === 'groups' ? 'select' : 'ss', server: '', port: 443, value: '' })
const isGroup = computed(() => props.module.kind === 'groups')
const items = computed(() => Array.isArray(store.get(props.module.rootKey!)) ? store.get(props.module.rootKey!) as Record<string, unknown>[] : [])
const shown = computed(() => items.value.map((value, index) => ({ value, index })).filter(({ value }) => `${value.name || ''} ${value.type || ''} ${value.server || ''}`.toLowerCase().includes(query.value.toLowerCase())))
const proxyTypes = ['ss','ssr','vmess','vless','trojan','hysteria2','tuic','wireguard','socks5','http']
const groupTypes = ['select','url-test','fallback','load-balance','relay']
const typeOptions = computed(() => (isGroup.value ? groupTypes : proxyTypes).map(value => ({ label: value, value })))

function reset() { Object.assign(draft, { name: '', type: isGroup.value ? 'select' : 'ss', server: '', port: 443, value: '' }) }
function add() {
  if (!String(draft.name).trim()) return
  const item: Record<string, unknown> = { name: String(draft.name).trim(), type: draft.type }
  if (isGroup.value) item.proxies = String(draft.value).split(',').map(value => value.trim()).filter(Boolean)
  else { item.server = draft.server; item.port = Number(draft.port) }
  store.setRoot(props.module.rootKey!, [...items.value, item])
  dialog.value = false; reset(); message.success(`${isGroup.value ? '代理组' : '节点'}已添加`)
}
function remove(index: number) { store.setRoot(props.module.rootKey!, items.value.filter((_, itemIndex) => itemIndex !== index)) }
function openEdit(index: number) { editIndex.value = index; editSource.value = stringify(items.value[index], { lineWidth: 0, indent: 2 }); editError.value = '' }
function applyEdit() {
  try {
    const value = parse(editSource.value) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('节点内容必须是 YAML 对象')
    const next = [...items.value]; next[editIndex.value!] = value as Record<string, unknown>
    store.setRoot(props.module.rootKey!, next); editIndex.value = null; editError.value = ''; message.success('完整配置已更新')
  } catch (cause) { editError.value = cause instanceof Error ? cause.message : '无法解析 YAML' }
}
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div><NButton type="primary" @click="dialog = true"><template #icon><Plus :size="15" /></template>添加{{ isGroup ? '代理组' : '节点' }}</NButton></header>
    <div class="collection-toolbar"><NInput v-model:value="query" clearable :placeholder="`搜索${module.label}`" class="collection-search"><template #prefix><Search :size="15" /></template></NInput><span>共 {{ items.length }} 项</span></div>
    <section v-if="shown.length" class="card-grid"><article v-for="item in shown" :key="item.index" class="item-card" @dblclick="openEdit(item.index)"><div class="item-type">{{ item.value.type || 'unknown' }}</div><h3>{{ item.value.name || `未命名 ${item.index + 1}` }}</h3><p v-if="!isGroup">{{ item.value.server || '未设置服务器' }}<span v-if="item.value.port">:{{ item.value.port }}</span></p><p v-else>{{ Array.isArray(item.value.proxies) ? `${item.value.proxies.length} 个成员` : '使用代理集合' }}</p><NButton size="tiny" class="edit-chip" @click="openEdit(item.index)">编辑</NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(item.index)"><template #trigger><NButton quaternary circle size="small" class="danger-icon" title="删除"><template #icon><Trash2 :size="15" /></template></NButton></template>删除后无法撤销，确定继续吗？</NPopconfirm></article></section>
    <div v-else class="editor-card empty-state">还没有{{ module.label }}，点击右上角开始添加</div>
    <NModal v-model:show="dialog" preset="card" :title="`添加${isGroup ? '代理组' : '代理节点'}`" class="form-modal" :bordered="false">
      <NForm label-placement="top" size="small"><NFormItem label="名称" required><NInput v-model:value="draft.name" placeholder="唯一名称" /></NFormItem><NFormItem label="类型"><NSelect v-model:value="draft.type" :options="typeOptions" /></NFormItem><template v-if="isGroup"><NFormItem label="组内成员"><NInput v-model:value="draft.value" placeholder="节点 A, 节点 B, DIRECT" /><template #feedback>以英文逗号分隔</template></NFormItem></template><template v-else><NFormItem label="服务器" required><NInput v-model:value="draft.server" placeholder="example.com" /></NFormItem><NFormItem label="端口" required><NInputNumber :value="Number(draft.port)" :min="1" :max="65535" @update:value="draft.port = $event ?? 443" /></NFormItem></template></NForm>
      <template #footer><div class="modal-actions"><NButton @click="dialog = false">取消</NButton><NButton type="primary" :disabled="!String(draft.name).trim()" @click="add">确认添加</NButton></div></template>
    </NModal>
    <NModal :show="editIndex !== null" preset="card" title="编辑完整 YAML 配置" class="item-edit-modal" :bordered="false" @update:show="!$event && (editIndex = null)"><NInput v-model:value="editSource" type="textarea" :autosize="{ minRows: 15, maxRows: 24 }" class="mono-input" /><p v-if="editError" class="inline-error">{{ editError }}</p><template #footer><div class="modal-actions"><NButton @click="editIndex = null">取消</NButton><NButton type="primary" @click="applyEdit">应用修改</NButton></div></template></NModal>
  </div>
</template>
