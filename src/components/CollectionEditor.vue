<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ExternalLink, Plus, Search, Trash2, X } from '@lucide/vue'
import { parse, stringify } from 'yaml'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const query = ref('')
const dialog = ref(false)
const editIndex = ref<number | null>(null)
const editSource = ref('')
const editError = ref('')
const draft = reactive<Record<string, string | number | boolean>>({ name: '', type: props.module.kind === 'groups' ? 'select' : 'ss', server: '', port: 443, value: '' })
const isGroup = computed(() => props.module.kind === 'groups')
const items = computed(() => Array.isArray(store.get(props.module.rootKey!)) ? store.get(props.module.rootKey!) as Record<string, unknown>[] : [])
const shown = computed(() => items.value.map((value, index) => ({ value, index })).filter(({ value }) => `${value.name || ''} ${value.type || ''} ${value.server || ''}`.toLowerCase().includes(query.value.toLowerCase())))
const proxyTypes = ['ss','ssr','vmess','vless','trojan','hysteria2','tuic','wireguard','socks5','http']
const groupTypes = ['select','url-test','fallback','load-balance','relay']

function reset() { Object.assign(draft, { name: '', type: isGroup.value ? 'select' : 'ss', server: '', port: 443, value: '' }) }
function add() {
  if (!String(draft.name).trim()) return
  const item: Record<string, unknown> = { name: String(draft.name).trim(), type: draft.type }
  if (isGroup.value) item.proxies = String(draft.value).split(',').map(value => value.trim()).filter(Boolean)
  else { item.server = draft.server; item.port = Number(draft.port) }
  store.setRoot(props.module.rootKey!, [...items.value, item])
  dialog.value = false; reset()
}
function remove(index: number) { store.setRoot(props.module.rootKey!, items.value.filter((_, itemIndex) => itemIndex !== index)) }
function openEdit(index: number) { editIndex.value = index; editSource.value = stringify(items.value[index], { lineWidth: 0, indent: 2 }); editError.value = '' }
function applyEdit() {
  try {
    const value = parse(editSource.value) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('节点内容必须是 YAML 对象')
    const next = [...items.value]; next[editIndex.value!] = value as Record<string, unknown>
    store.setRoot(props.module.rootKey!, next); editIndex.value = null; editError.value = ''
  } catch (cause) { editError.value = cause instanceof Error ? cause.message : '无法解析 YAML' }
}
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div><button class="primary-button" @click="dialog = true"><Plus :size="15" />添加{{ isGroup ? '代理组' : '节点' }}</button></header>
    <div class="collection-toolbar"><div class="search-box"><Search :size="15" /><input v-model="query" :placeholder="`搜索${module.label}`" /></div><span>共 {{ items.length }} 项</span></div>
    <section v-if="shown.length" class="card-grid"><article v-for="item in shown" :key="item.index" class="item-card" @dblclick="openEdit(item.index)"><div class="item-type">{{ item.value.type || 'unknown' }}</div><h3>{{ item.value.name || `未命名 ${item.index + 1}` }}</h3><p v-if="!isGroup">{{ item.value.server || '未设置服务器' }}<span v-if="item.value.port">:{{ item.value.port }}</span></p><p v-else>{{ Array.isArray(item.value.proxies) ? `${item.value.proxies.length} 个成员` : '使用代理集合' }}</p><button class="edit-chip" @click="openEdit(item.index)">编辑</button><button class="danger-icon" title="删除" @click="remove(item.index)"><Trash2 :size="15" /></button></article></section>
    <div v-else class="editor-card empty-state">还没有{{ module.label }}，点击右上角开始添加</div>
    <div v-if="dialog" class="modal-backdrop" @click.self="dialog = false"><form class="modal" @submit.prevent="add"><header><div><span>NEW ITEM</span><h2>添加{{ isGroup ? '代理组' : '代理节点' }}</h2></div><button type="button" @click="dialog = false"><X :size="18" /></button></header><label>名称<input v-model="draft.name" required placeholder="唯一名称" /></label><label>类型<select v-model="draft.type"><option v-for="type in (isGroup ? groupTypes : proxyTypes)" :key="type">{{ type }}</option></select></label><template v-if="isGroup"><label>组内成员<input v-model="draft.value" placeholder="节点 A, 节点 B, DIRECT" /><small>以英文逗号分隔；添加后可在 YAML 预览中看到结果</small></label></template><template v-else><label>服务器<input v-model="draft.server" required placeholder="example.com" /></label><label>端口<input v-model.number="draft.port" required type="number" min="1" max="65535" /></label></template><footer><button type="button" class="ghost-button" @click="dialog = false">取消</button><button class="primary-button">确认添加</button></footer></form></div>
    <div v-if="editIndex !== null" class="modal-backdrop" @click.self="editIndex = null"><section class="modal item-edit-modal"><header><div><span>YAML ITEM</span><h2>编辑完整配置</h2></div><button @click="editIndex = null"><X :size="18" /></button></header><textarea v-model="editSource" spellcheck="false" /><p v-if="editError" class="inline-error">{{ editError }}</p><footer><button class="ghost-button" @click="editIndex = null">取消</button><button class="primary-button" @click="applyEdit">应用修改</button></footer></section></div>
  </div>
</template>
