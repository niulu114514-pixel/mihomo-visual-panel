<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ClipboardPaste, Layers3, Pencil, Plus, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NCollapse, NCollapseItem, NInput, NModal, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import ConfigField from '@/components/ConfigField.vue'
import VisualValueEditor from '@/components/VisualValueEditor.vue'
import type { ConfigFieldSchema } from '@/schemas/types'
import { useSingBoxStore } from '@/stores/singbox'
import { parseProxyInput } from '@/utils/proxy-import'
import { clone, readPath, records, writePath } from './helpers'

const store = useSingBoxStore()
const message = useMessage()
const dialogOpen = ref(false)
const importOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draft = ref<Record<string, unknown>>({})
const importSource = ref('')
const importError = ref('')
const items = computed(() => records(store.config.outbounds))
const groupTypes = new Set(['selector', 'urltest'])
const typeOptions = ['selector', 'urltest', 'direct', 'block', 'socks', 'http', 'shadowsocks', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'ssh', 'anytls', 'shadowtls', 'tor', 'dns'].map((value) => ({ label: value, value }))
const availableOutbounds = computed(() => items.value.map((item, index) => ({ index, value: String(item.tag || '') })).filter((item) => item.value && item.index !== editingIndex.value).map((item) => ({ label: item.value, value: item.value })))
const selectedMembers = computed<string[]>(() => Array.isArray(draft.value.outbounds) ? draft.value.outbounds.map(String) : [])

const identityFields: Record<string, ConfigFieldSchema[]> = {
  socks: [{ path: 'username', label: '用户名', type: 'text' }, { path: 'password', label: '密码', type: 'text' }],
  http: [{ path: 'username', label: '用户名', type: 'text' }, { path: 'password', label: '密码', type: 'text' }],
  shadowsocks: [{ path: 'method', label: '加密方式', type: 'text', placeholder: '2022-blake3-aes-128-gcm' }, { path: 'password', label: '密码', type: 'text' }],
  vmess: [{ path: 'uuid', label: 'UUID', type: 'text' }, { path: 'security', label: '加密', type: 'select', options: ['auto', 'none', 'zero'].map((value) => ({ label: value, value })) }],
  vless: [{ path: 'uuid', label: 'UUID', type: 'text' }, { path: 'flow', label: 'Flow', type: 'text', placeholder: 'xtls-rprx-vision' }],
  trojan: [{ path: 'password', label: '密码', type: 'text' }],
  hysteria2: [{ path: 'password', label: '密码', type: 'text' }],
  tuic: [{ path: 'uuid', label: 'UUID', type: 'text' }, { path: 'password', label: '密码', type: 'text' }],
  anytls: [{ path: 'password', label: '密码', type: 'text' }],
}
const serverFields: ConfigFieldSchema[] = [{ path: 'server', label: '服务器', type: 'text', placeholder: 'example.com' }, { path: 'server_port', label: '端口', type: 'number', min: 1, max: 65535, placeholder: '443' }]
const tlsFields: ConfigFieldSchema[] = [{ path: 'tls.enabled', label: '启用 TLS', type: 'switch' }, { path: 'tls.server_name', label: 'TLS 服务器名称', type: 'text', placeholder: 'example.com' }, { path: 'tls.insecure', label: '跳过证书验证', type: 'switch', description: '不安全，仅用于临时排错' }]
const nodeFields = computed(() => {
  const type = String(draft.value.type || '')
  if (groupTypes.has(type) || ['direct', 'block'].includes(type)) return []
  return [...serverFields, ...(identityFields[type] ?? []), ...(['vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'anytls'].includes(type) ? tlsFields : [])]
})

function defaults(type: string): Record<string, unknown> {
  if (type === 'selector') return { type, tag: 'proxy', outbounds: [], interrupt_exist_connections: false }
  if (type === 'urltest') return { type, tag: 'auto', outbounds: [], url: 'https://www.gstatic.com/generate_204', interval: '3m', tolerance: 50, idle_timeout: '30m' }
  if (type === 'direct') return { type, tag: 'direct' }
  if (type === 'block') return { type, tag: 'block' }
  return { type, tag: `${type}-out`, server: '', server_port: 443 }
}
function openNew(type = 'selector') { editingIndex.value = null; draft.value = defaults(type); dialogOpen.value = true }
function openEdit(index: number) { editingIndex.value = index; draft.value = clone(items.value[index] ?? {}); dialogOpen.value = true }
function changeType(type: string) { draft.value = { ...defaults(type), tag: draft.value.tag || defaults(type).tag } }
function patch(path: string, value: unknown) { draft.value = writePath(draft.value, path, value) }
function save() {
  const tag = String(draft.value.tag || '').trim()
  const type = String(draft.value.type || '')
  if (!tag) return message.warning('请填写出站标签')
  if (items.value.some((item, index) => index !== editingIndex.value && item.tag === tag)) return message.error(`出站标签“${tag}”已经存在`)
  if (groupTypes.has(type) && !selectedMembers.value.length) return message.warning('请至少选择一个组内出站')
  if (selectedMembers.value.includes(tag)) return message.error('出站组不能引用自身')
  const next = clone(items.value)
  const value = { ...draft.value, tag }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.setRoot('outbounds', next)
  dialogOpen.value = false
  message.success('出站已保存')
}
function remove(index: number) { const next = clone(items.value); next.splice(index, 1); store.setRoot('outbounds', next) }
function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= items.value.length) return; const next = clone(items.value); [next[index], next[target]] = [next[target]!, next[index]!]; store.setRoot('outbounds', next) }
function updateMembers(value: string[]) { patch('outbounds', value); if (draft.value.default && !value.includes(String(draft.value.default))) patch('default', undefined) }
function uniqueTag(value: Record<string, unknown>, used: Set<string>) {
  const original = String(value.tag || `${value.type || 'outbound'}-${used.size + 1}`)
  let tag = original
  let suffix = 2
  while (used.has(tag)) tag = `${original}-${suffix++}`
  used.add(tag)
  return { ...value, tag }
}
function importOutbounds() {
  try {
    const parsed = parseProxyInput(importSource.value, 'sing-box')
    if (!parsed.length) throw new Error('没有识别到出站节点')
    const used = new Set(items.value.map((item) => String(item.tag || '')).filter(Boolean))
    store.setRoot('outbounds', [...clone(items.value), ...parsed.map((item) => uniqueTag(item, used))])
    importOpen.value = false
    importSource.value = ''
    importError.value = ''
    message.success(`已导入 ${parsed.length} 个出站节点`)
  } catch (cause) { importError.value = cause instanceof Error ? cause.message : '节点导入失败' }
}
</script>

<template>
  <section class="singbox-module-panel">
    <header class="singbox-module-heading"><div><h2>出站与代理组</h2><p>普通节点、直连/拦截以及可嵌套的 selector、urltest 代理组统一管理。</p></div><div class="heading-actions"><NButton secondary @click="importOpen=true"><template #icon><ClipboardPaste :size="15" /></template>粘贴导入</NButton><NButton secondary @click="openNew('selector')"><template #icon><Layers3 :size="15" /></template>添加代理组</NButton><NButton type="primary" @click="openNew('direct')"><template #icon><Plus :size="15" /></template>添加出站</NButton></div></header>
    <div v-if="items.length" class="singbox-card-grid"><article v-for="(item,index) in items" :key="`${item.tag}-${index}`" class="item-card structured-card singbox-item-card"><div class="item-type">{{ item.type }}</div><h3>{{ item.tag || `未命名出站 ${index + 1}` }}</h3><p v-if="groupTypes.has(String(item.type))">{{ Array.isArray(item.outbounds) ? item.outbounds.length : 0 }} 个组内出站</p><p v-else-if="item.server">{{ item.server }}:{{ item.server_port }}</p><p v-else>内置出站</p><div v-if="groupTypes.has(String(item.type))" class="group-tags"><span v-for="member in (Array.isArray(item.outbounds) ? item.outbounds.slice(0,3) : [])" :key="String(member)">{{ member }}</span><span v-if="Array.isArray(item.outbounds) && item.outbounds.length>3">+{{ item.outbounds.length-3 }}</span></div><div class="card-actions"><NButton quaternary circle :disabled="index===0" title="上移" @click="move(index,-1)"><template #icon><ArrowUp :size="14" /></template></NButton><NButton quaternary circle :disabled="index===items.length-1" title="下移" @click="move(index,1)"><template #icon><ArrowDown :size="14" /></template></NButton><NButton quaternary circle title="可视化编辑" @click="openEdit(index)"><template #icon><Pencil :size="14" /></template></NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(index)"><template #trigger><NButton quaternary circle title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>删除后引用此标签的规则会报错，确定继续吗？</NPopconfirm></div></article></div>
    <div v-else class="editor-card empty-state">还没有出站，请先添加 direct、节点或代理组</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex===null?'添加':'编辑'}出站`" class="structured-modal singbox-visual-modal" :bordered="false"><NAlert type="info" :bordered="false">代理组成员只能从已有出站中选择；“全部字段”可完整编辑任意协议结构。</NAlert><div class="visual-form singbox-modal-form"><div class="config-field"><div class="field-copy"><label>出站类型</label><p>支持普通节点、内置出站和代理组</p></div><NSelect :value="String(draft.type||'selector')" :options="typeOptions" filterable tag @update:value="changeType" /></div><ConfigField :field="{path:'tag',label:'出站标签',type:'text',placeholder:'proxy',description:'必须唯一，路由和其他代理组通过它引用'}" :model-value="draft.tag" @update:model-value="patch('tag',$event)" /><template v-if="groupTypes.has(String(draft.type))"><div class="config-field config-field--wide"><div class="field-copy"><label>组内出站</label><p>支持嵌套已有 selector 或 urltest 组</p></div><NSelect multiple filterable :value="selectedMembers" :options="availableOutbounds" placeholder="选择一个或多个已有出站" @update:value="updateMembers" /></div><div v-if="draft.type==='selector'" class="config-field"><div class="field-copy"><label>默认选择</label><p>不设置时使用第一个成员</p></div><NSelect clearable :value="draft.default ? String(draft.default) : null" :options="selectedMembers.map(value=>({label:value,value}))" @update:value="patch('default',$event)" /></div><template v-if="draft.type==='urltest'"><ConfigField :field="{path:'url',label:'测速地址',type:'text',placeholder:'https://www.gstatic.com/generate_204'}" :model-value="draft.url" @update:model-value="patch('url',$event)" /><ConfigField :field="{path:'interval',label:'测速间隔',type:'text',placeholder:'3m'}" :model-value="draft.interval" @update:model-value="patch('interval',$event)" /><ConfigField :field="{path:'tolerance',label:'切换容差（毫秒）',type:'number',min:0,placeholder:'50'}" :model-value="draft.tolerance" @update:model-value="patch('tolerance',$event)" /><ConfigField :field="{path:'idle_timeout',label:'空闲超时',type:'text',placeholder:'30m'}" :model-value="draft.idle_timeout" @update:model-value="patch('idle_timeout',$event)" /></template><ConfigField :field="{path:'interrupt_exist_connections',label:'切换时中断旧连接',type:'switch'}" :model-value="draft.interrupt_exist_connections" @update:model-value="patch('interrupt_exist_connections',$event)" /></template><ConfigField v-for="field in nodeFields" :key="field.path" :field="field" :model-value="readPath(draft,field.path)" @update:model-value="patch(field.path,$event)" /></div><NCollapse class="full-field-collapse"><NCollapseItem title="全部字段（完整可视化）" name="all"><VisualValueEditor v-model="draft" root /></NCollapseItem></NCollapse><template #footer><div class="modal-actions"><NButton @click="dialogOpen=false">取消</NButton><NButton type="primary" @click="save">保存出站</NButton></div></template></NModal>
    <NModal v-model:show="importOpen" preset="card" title="粘贴导入出站节点" class="structured-modal import-modal" :bordered="false"><NAlert type="info" :bordered="false">支持 sing-box JSON/JSONC、Mihomo YAML、单个对象、对象数组，以及 ss、vmess、vless、trojan、hysteria2、tuic、socks、http、anytls 分享链接；每行一个链接。</NAlert><NInput v-model:value="importSource" type="textarea" class="mono-input" :autosize="{minRows:12,maxRows:24}" placeholder="粘贴配置或分享链接" /><p v-if="importError" class="inline-error">{{ importError }}</p><template #footer><div class="modal-actions"><NButton @click="importOpen=false">取消</NButton><NButton type="primary" @click="importOutbounds">解析并导入</NButton></div></template></NModal>
  </section>
</template>
