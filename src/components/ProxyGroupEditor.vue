<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NInput, NModal, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import ConfigField from './ConfigField.vue'
import type { ConfigFieldSchema, ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const query = ref('')
const dialogOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draft = ref<Record<string, unknown>>({})
const builtins = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL']

const asRecords = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : []
const groups = computed(() => asRecords(store.get('proxy-groups')))
const proxyNames = computed(() => asRecords(store.get('proxies')).map((item) => String(item.name || '')).filter(Boolean))
const providerNames = computed(() => {
  const value = store.get('proxy-providers')
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : []
})
const selectedMembers = computed(() => list(draft.value.proxies))
const selectedProviders = computed(() => list(draft.value.use))
const memberOptions = computed(() => {
  const otherGroups = groups.value.map((group, index) => ({ index, name: String(group.name || '') })).filter((item) => item.name && item.index !== editingIndex.value).map((item) => ({ label: item.name, value: item.name }))
  const known = new Set([...builtins, ...proxyNames.value, ...otherGroups.map((item) => item.value)])
  const unknown = selectedMembers.value.filter((value) => !known.has(value)).map((value) => ({ label: `${value}（原配置）`, value }))
  return [
    { type: 'group' as const, label: '内置策略', key: 'builtin', children: builtins.map((value) => ({ label: value, value })) },
    { type: 'group' as const, label: `代理节点（${proxyNames.value.length}）`, key: 'proxies', children: proxyNames.value.map((value) => ({ label: value, value })) },
    { type: 'group' as const, label: `其他代理组（${otherGroups.length}）`, key: 'groups', children: otherGroups },
    ...(unknown.length ? [{ type: 'group' as const, label: '原配置中的自定义项', key: 'unknown', children: unknown }] : []),
  ]
})
const providerOptions = computed(() => {
  const known = new Set(providerNames.value)
  return [...providerNames.value.map((value) => ({ label: value, value })), ...selectedProviders.value.filter((value) => !known.has(value)).map((value) => ({ label: `${value}（原配置）`, value }))]
})
const directProxyOptions = computed(() => [...builtins.filter((value) => value !== 'GLOBAL'), ...proxyNames.value].map((value) => ({ label: value, value })))
const defaultOptions = computed(() => selectedMembers.value.map((value) => ({ label: value, value })))
const shown = computed(() => groups.value.map((value, index) => ({ value, index })).filter(({ value }) => {
  const keyword = query.value.trim().toLowerCase()
  return !keyword || `${value.name ?? ''} ${value.type ?? ''} ${JSON.stringify(value.proxies ?? [])} ${JSON.stringify(value.use ?? [])}`.toLowerCase().includes(keyword)
}))

const fields: ConfigFieldSchema[] = [
  { path: 'name', label: '代理组名称', type: 'text', placeholder: '例如：节点选择', description: '必须唯一，路由规则会通过此名称引用' },
  { path: 'type', label: '代理组类型', type: 'select', options: ['select', 'url-test', 'fallback', 'load-balance', 'relay'].map((value) => ({ label: value, value })) },
  { path: 'url', label: '健康检查地址', type: 'text', placeholder: 'https://www.gstatic.com/generate_204' },
  { path: 'interval', label: '检查间隔（秒）', type: 'number', min: 0, placeholder: '300' },
  { path: 'timeout', label: '检查超时（毫秒）', type: 'number', min: 1, placeholder: '5000' },
  { path: 'tolerance', label: '切换容差（毫秒）', type: 'number', min: 0, placeholder: '50', description: '仅用于 url-test' },
  { path: 'max-failed-times', label: '最大失败次数', type: 'number', min: 0, placeholder: '5' },
  { path: 'lazy', label: '惰性检查', type: 'switch' },
  { path: 'strategy', label: '负载均衡策略', type: 'select', options: ['round-robin', 'consistent-hashing'].map((value) => ({ label: value, value })) },
  { path: 'disable-udp', label: '禁用 UDP', type: 'switch' },
  { path: 'include-all', label: '包含全部节点与集合', type: 'switch' },
  { path: 'include-all-proxies', label: '包含全部代理节点', type: 'switch' },
  { path: 'include-all-providers', label: '包含全部代理集合', type: 'switch' },
  { path: 'filter', label: '包含筛选', type: 'text', placeholder: '(?i)港|HK' },
  { path: 'exclude-filter', label: '排除筛选', type: 'text', placeholder: '到期|剩余流量' },
  { path: 'exclude-type', label: '排除协议', type: 'text', placeholder: 'Shadowsocks|Http' },
  { path: 'expected-status', label: '期望 HTTP 状态', type: 'text', placeholder: '200/302/400-503' },
  { path: 'hidden', label: '在 API 中隐藏', type: 'switch' },
  { path: 'icon', label: '图标地址', type: 'text', placeholder: 'https://example.com/icon.svg' },
]

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function readPath(path: string): unknown { return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, draft.value) }
function writePath(path: string, value: unknown) {
  const next = clone(draft.value)
  const keys = path.split('.')
  let cursor = next
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete cursor[key]
      else cursor[key] = value
    } else {
      if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
      cursor = cursor[key] as Record<string, unknown>
    }
  })
  draft.value = next
}
function openNew() { editingIndex.value = null; draft.value = { name: '', type: 'select', proxies: ['DIRECT'] }; dialogOpen.value = true }
function openEdit(index: number) { editingIndex.value = index; draft.value = clone(groups.value[index] ?? {}); dialogOpen.value = true }
function save() {
  const name = String(draft.value.name ?? '').trim()
  if (!name) return message.warning('请填写代理组名称')
  if (!draft.value.type) return message.warning('请选择代理组类型')
  if (groups.value.some((group, index) => index !== editingIndex.value && group.name === name)) return message.error(`代理组“${name}”已经存在`)
  if (selectedMembers.value.includes(name)) return message.error('代理组不能引用自身')
  const next = clone(groups.value)
  const value = { ...draft.value, name }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.setRoot('proxy-groups', next)
  dialogOpen.value = false
  message.success('代理组已保存')
}
function remove(index: number) { store.setRoot('proxy-groups', groups.value.filter((_, itemIndex) => itemIndex !== index)) }
function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= groups.value.length) return; const next = clone(groups.value); [next[index], next[target]] = [next[target]!, next[index]!]; store.setRoot('proxy-groups', next) }
function members(group: Record<string, unknown>) { return `${list(group.proxies).length} 个成员 · ${list(group.use).length} 个代理集合` }
</script>

<template>
  <div class="module-content group-module">
    <header class="module-heading module-heading--actions"><div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div><NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加代理组</NButton></header>
    <div class="collection-toolbar"><NInput v-model:value="query" clearable placeholder="搜索名称、类型或成员" class="collection-search"><template #prefix><Search :size="15" /></template></NInput><span>共 {{ groups.length }} 个代理组</span></div>
    <section v-if="shown.length" class="card-grid group-grid"><article v-for="item in shown" :key="`${item.index}-${item.value.name}`" class="item-card structured-card group-card editable-card" role="group" :aria-label="`编辑${String(item.value.name || `未命名组 ${item.index + 1}`)}`" tabindex="0" @click="openEdit(item.index)" @keydown.enter="openEdit(item.index)"><div class="item-type">{{ item.value.type || '未设置类型' }}</div><h3>{{ item.value.name || `未命名组 ${item.index + 1}` }}</h3><p>{{ members(item.value) }}</p><div class="group-tags"><span v-for="member in list(item.value.proxies).slice(0,3)" :key="member">{{ member }}</span><span v-if="list(item.value.proxies).length > 3">+{{ list(item.value.proxies).length - 3 }}</span></div><div class="card-actions" @click.stop><NButton quaternary circle size="tiny" :disabled="item.index===0" title="上移" @click="move(item.index,-1)"><template #icon><ArrowUp :size="14" /></template></NButton><NButton quaternary circle size="tiny" :disabled="item.index===groups.length-1" title="下移" @click="move(item.index,1)"><template #icon><ArrowDown :size="14" /></template></NButton><NButton quaternary circle size="tiny" title="可视化编辑" @click="openEdit(item.index)"><template #icon><Pencil :size="14" /></template></NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(item.index)"><template #trigger><NButton quaternary circle size="tiny" title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>确定删除这个代理组吗？</NPopconfirm></div></article></section>
    <div v-else class="editor-card empty-state">还没有代理组，点击“添加代理组”开始配置</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex===null?'添加':'编辑'}代理组`" class="structured-modal group-modal" :bordered="false"><NAlert type="info" :bordered="false">候选项来自当前配置中的代理节点、订阅集合和其他代理组；原配置中的特殊名称也会保留。</NAlert><div class="visual-form group-form"><ConfigField v-for="field in fields.slice(0,2)" :key="field.path" :field="field" :model-value="readPath(field.path)" @update:model-value="writePath(field.path,$event)" /><div class="config-field config-field--wide"><div class="field-copy"><label>组内成员</label><p>选择代理节点、内置策略或其他代理组，支持搜索和嵌套</p></div><NSelect multiple filterable :value="selectedMembers" :options="memberOptions" placeholder="选择现有节点或代理组" max-tag-count="responsive" @update:value="writePath('proxies',$event)" /></div><div class="config-field config-field--wide"><div class="field-copy"><label>引用代理集合</label><p>自动读取 proxy-providers 中的订阅名称</p></div><NSelect multiple filterable :value="selectedProviders" :options="providerOptions" placeholder="选择一个或多个代理集合" max-tag-count="responsive" @update:value="writePath('use',$event)" /></div><div class="config-field"><div class="field-copy"><label>默认选中节点</label><p>只能选择当前组内成员</p></div><NSelect clearable filterable :value="draft['default-selected'] ? String(draft['default-selected']) : null" :options="defaultOptions" placeholder="默认使用第一个成员" @update:value="writePath('default-selected',$event)" /></div><div class="config-field"><div class="field-copy"><label>空组回退节点</label><p>Mihomo 仅允许节点或内置策略，不能选择代理组</p></div><NSelect clearable filterable tag :value="draft['empty-fallback'] ? String(draft['empty-fallback']) : null" :options="directProxyOptions" placeholder="COMPATIBLE" @update:value="writePath('empty-fallback',$event)" /></div><ConfigField v-for="field in fields.slice(2)" :key="field.path" :field="field" :model-value="readPath(field.path)" @update:model-value="writePath(field.path,$event)" /></div><template #footer><div class="modal-actions"><NButton @click="dialogOpen=false">取消</NButton><NButton type="primary" @click="save">保存代理组</NButton></div></template></NModal>
  </div>
</template>
