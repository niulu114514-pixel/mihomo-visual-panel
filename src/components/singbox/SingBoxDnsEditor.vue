<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NModal, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import ConfigField from '@/components/ConfigField.vue'
import type { ConfigFieldSchema } from '@/schemas/types'
import { useSingBoxStore } from '@/stores/singbox'
import { clone, readPath, records, writePath } from './helpers'

const store = useSingBoxStore()
const message = useMessage()
const dialogOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draft = ref<Record<string, unknown>>({})
const items = computed(() => records(store.get('dns.servers')))
const tags = computed(() => items.value.map((item) => String(item.tag || '')).filter(Boolean).map((value) => ({ label: value, value })))
const typeOptions = ['local', 'udp', 'tcp', 'tls', 'https', 'h3', 'fakeip', 'hosts', 'dhcp'].map((value) => ({ label: value, value }))
const strategyOptions = ['prefer_ipv4', 'prefer_ipv6', 'ipv4_only', 'ipv6_only'].map((value) => ({ label: value, value }))

const serverFields: ConfigFieldSchema[] = [
  { path: 'server', label: '服务器地址', type: 'text', placeholder: '1.1.1.1' },
  { path: 'server_port', label: '服务器端口', type: 'number', min: 1, max: 65535, placeholder: '53' },
]
const tlsFields: ConfigFieldSchema[] = [
  { path: 'tls.enabled', label: '启用 TLS', type: 'switch' },
  { path: 'tls.server_name', label: 'TLS 服务器名称', type: 'text', placeholder: 'cloudflare-dns.com' },
  { path: 'tls.insecure', label: '跳过证书验证', type: 'switch', description: '不安全，仅用于临时排错' },
]
const fields = computed<ConfigFieldSchema[]>(() => {
  const type = String(draft.value.type || '')
  if (['udp', 'tcp'].includes(type)) return serverFields
  if (['tls', 'https', 'h3'].includes(type)) return [...serverFields, ...tlsFields, ...(['https', 'h3'].includes(type) ? [{ path: 'path', label: 'DoH 路径', type: 'text' as const, placeholder: '/dns-query' }] : [])]
  if (type === 'fakeip') return [{ path: 'inet4_range', label: 'IPv4 地址池', type: 'text', placeholder: '198.18.0.0/15' }, { path: 'inet6_range', label: 'IPv6 地址池', type: 'text', placeholder: 'fc00::/18' }]
  if (type === 'hosts') return [{ path: 'path', label: 'Hosts 文件', type: 'text', placeholder: './hosts' }]
  if (type === 'dhcp') return [{ path: 'interface', label: '网络接口', type: 'text', placeholder: '自动检测' }]
  return []
})

function defaults(type: string): Record<string, unknown> {
  if (type === 'local') return { type, tag: 'local' }
  if (type === 'fakeip') return { type, tag: 'fakeip', inet4_range: '198.18.0.0/15', inet6_range: 'fc00::/18' }
  if (type === 'hosts') return { type, tag: 'hosts', path: './hosts' }
  if (type === 'dhcp') return { type, tag: 'dhcp' }
  if (type === 'https' || type === 'h3') return { type, tag: `${type}-dns`, server: '1.1.1.1', server_port: 443, path: '/dns-query', tls: { enabled: true, server_name: 'cloudflare-dns.com' } }
  if (type === 'tls') return { type, tag: 'tls-dns', server: '1.1.1.1', server_port: 853, tls: { enabled: true, server_name: 'cloudflare-dns.com' } }
  return { type, tag: `${type}-dns`, server: '1.1.1.1', server_port: 53 }
}
function openNew() { editingIndex.value = null; draft.value = defaults('local'); dialogOpen.value = true }
function openEdit(index: number) { editingIndex.value = index; draft.value = clone(items.value[index] ?? {}); dialogOpen.value = true }
function changeType(type: string) { draft.value = { ...defaults(type), tag: draft.value.tag || defaults(type).tag } }
function patch(path: string, value: unknown) { draft.value = writePath(draft.value, path, value) }
function save() {
  const tag = String(draft.value.tag || '').trim()
  if (!tag) return message.warning('请填写 DNS 服务器标签')
  if (items.value.some((item, index) => index !== editingIndex.value && item.tag === tag)) return message.error(`DNS 标签“${tag}”已经存在`)
  const next = clone(items.value)
  const value = { ...draft.value, tag }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.set('dns.servers', next)
  dialogOpen.value = false
  message.success('DNS 服务器已保存')
}
function remove(index: number) { const next = clone(items.value); next.splice(index, 1); store.set('dns.servers', next) }
function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= items.value.length) return; const next = clone(items.value); [next[index], next[target]] = [next[target]!, next[index]!]; store.set('dns.servers', next) }
</script>

<template>
  <section class="singbox-module-panel">
    <header class="singbox-module-heading"><div><h2>DNS</h2><p>管理解析策略、默认 DNS 与常用 DNS 服务器；复杂 DNS 规则仍会完整保留。</p></div><NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加 DNS</NButton></header>
    <div class="editor-card singbox-form-card visual-form singbox-dns-settings">
      <div class="config-field"><div class="field-copy"><label>解析策略</label><p>选择优先或仅使用的 IP 版本</p></div><NSelect clearable :value="store.get('dns.strategy') ? String(store.get('dns.strategy')) : null" :options="strategyOptions" placeholder="系统默认" @update:value="store.set('dns.strategy',$event)" /></div>
      <div class="config-field"><div class="field-copy"><label>默认 DNS</label><p>从下方已有服务器中选择</p></div><NSelect clearable filterable :value="store.get('dns.final') ? String(store.get('dns.final')) : null" :options="tags" placeholder="未设置" @update:value="store.set('dns.final',$event)" /></div>
      <ConfigField :field="{path:'disable_cache',label:'禁用 DNS 缓存',type:'switch'}" :model-value="store.get('dns.disable_cache')" @update:model-value="store.set('dns.disable_cache',$event)" />
      <ConfigField :field="{path:'reverse_mapping',label:'保存反向映射',type:'switch',description:'为路由保留 IP 到域名映射'}" :model-value="store.get('dns.reverse_mapping')" @update:model-value="store.set('dns.reverse_mapping',$event)" />
    </div>
    <div v-if="items.length" class="singbox-card-grid"><article v-for="(item,index) in items" :key="`${item.tag}-${index}`" class="item-card structured-card singbox-item-card"><div class="item-type">{{ item.type }}</div><h3>{{ item.tag || `未命名 DNS ${index+1}` }}</h3><p v-if="item.server">{{ item.server }}<span v-if="item.server_port">:{{ item.server_port }}</span></p><p v-else>{{ item.type === 'fakeip' ? item.inet4_range : '本地解析器' }}</p><div class="card-actions"><NButton quaternary circle :disabled="index===0" title="上移" @click="move(index,-1)"><template #icon><ArrowUp :size="14" /></template></NButton><NButton quaternary circle :disabled="index===items.length-1" title="下移" @click="move(index,1)"><template #icon><ArrowDown :size="14" /></template></NButton><NButton quaternary circle title="可视化编辑" @click="openEdit(index)"><template #icon><Pencil :size="14" /></template></NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(index)"><template #trigger><NButton quaternary circle title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>删除后引用此标签的 DNS 规则会报错，确定继续吗？</NPopconfirm></div></article></div>
    <div v-else class="editor-card empty-state">还没有 DNS 服务器，可先添加 local 或加密 DNS</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex===null?'添加':'编辑'} DNS 服务器`" class="structured-modal singbox-visual-modal" :bordered="false"><NAlert type="info" :bordered="false">支持 sing-box 1.14 的 typed DNS Server。保持类型不变时，未展示的高级字段不会丢失。</NAlert><div class="visual-form singbox-modal-form"><div class="config-field"><div class="field-copy"><label>服务器类型</label><p>本地、传统 DNS、加密 DNS 或 FakeIP</p></div><NSelect :value="String(draft.type||'local')" :options="typeOptions" @update:value="changeType" /></div><ConfigField :field="{path:'tag',label:'服务器标签',type:'text',placeholder:'local',description:'必须唯一，DNS 规则通过标签引用'}" :model-value="draft.tag" @update:model-value="patch('tag',$event)" /><ConfigField v-for="field in fields" :key="field.path" :field="field" :model-value="readPath(draft,field.path)" @update:model-value="patch(field.path,$event)" /></div><template #footer><div class="modal-actions"><NButton @click="dialogOpen=false">取消</NButton><NButton type="primary" @click="save">保存 DNS</NButton></div></template></NModal>
  </section>
</template>


