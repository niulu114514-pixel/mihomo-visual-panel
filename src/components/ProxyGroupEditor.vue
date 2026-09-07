<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NInput, NModal, NPopconfirm, useMessage } from 'naive-ui'
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

const groups = computed(() => Array.isArray(store.get('proxy-groups')) ? store.get('proxy-groups') as Record<string, unknown>[] : [])
const shown = computed(() => groups.value.map((value, index) => ({ value, index })).filter(({ value }) => {
  const keyword = query.value.trim().toLowerCase()
  return !keyword || `${value.name ?? ''} ${value.type ?? ''} ${JSON.stringify(value.proxies ?? [])} ${JSON.stringify(value.use ?? [])}`.toLowerCase().includes(keyword)
}))

const fields: ConfigFieldSchema[] = [
  { path: 'name', label: '代理组名称', type: 'text', placeholder: '例如：节点选择', description: '必须唯一，路由规则会通过此名称引用' },
  { path: 'type', label: '代理组类型', type: 'select', options: ['select', 'url-test', 'fallback', 'load-balance', 'relay'].map((value) => ({ label: value, value })) },
  { path: 'proxies', label: '组内成员', type: 'tags', placeholder: '输入节点或代理组名称，回车添加', description: '可填写代理节点、其他代理组以及 DIRECT 等内置策略' },
  { path: 'use', label: '引用代理集合', type: 'tags', placeholder: '输入代理集合名称，回车添加' },
  { path: 'url', label: '健康检查地址', type: 'text', placeholder: 'https://www.gstatic.com/generate_204' },
  { path: 'interval', label: '检查间隔（秒）', type: 'number', min: 0, placeholder: '300' },
  { path: 'timeout', label: '检查超时（毫秒）', type: 'number', min: 1, placeholder: '5000' },
  { path: 'tolerance', label: '切换容差（毫秒）', type: 'number', min: 0, placeholder: '50', description: '仅用于 url-test' },
  { path: 'max-failed-times', label: '最大失败次数', type: 'number', min: 0, placeholder: '5' },
  { path: 'lazy', label: '惰性检查', type: 'switch' },
  { path: 'strategy', label: '负载均衡策略', type: 'select', options: ['round-robin', 'consistent-hashing'].map((value) => ({ label: value, value })) },
  { path: 'default-selected', label: '默认选中节点', type: 'text', placeholder: '组内节点名称' },
  { path: 'empty-fallback', label: '空组回退节点', type: 'text', placeholder: 'COMPATIBLE' },
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

function openNew() {
  editingIndex.value = null
  draft.value = { name: '', type: 'select', proxies: ['DIRECT'] }
  dialogOpen.value = true
}
function openEdit(index: number) {
  editingIndex.value = index
  draft.value = clone(groups.value[index] ?? {})
  dialogOpen.value = true
}
function save() {
  const name = String(draft.value.name ?? '').trim()
  if (!name) return message.warning('请填写代理组名称')
  if (!draft.value.type) return message.warning('请选择代理组类型')
  if (groups.value.some((group, index) => index !== editingIndex.value && group.name === name)) return message.error(`代理组“${name}”已经存在`)
  const next = clone(groups.value)
  const value = { ...draft.value, name }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.setRoot('proxy-groups', next)
  dialogOpen.value = false
  message.success('代理组已保存')
}
function remove(index: number) { store.setRoot('proxy-groups', groups.value.filter((_, itemIndex) => itemIndex !== index)) }
function move(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= groups.value.length) return
  const next = clone(groups.value)
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  store.setRoot('proxy-groups', next)
}
function members(group: Record<string, unknown>) {
  const proxyCount = Array.isArray(group.proxies) ? group.proxies.length : 0
  const providerCount = Array.isArray(group.use) ? group.use.length : 0
  return `${proxyCount} 个成员 · ${providerCount} 个代理集合`
}
</script>

<template>
  <div class="module-content group-module">
    <header class="module-heading module-heading--actions">
      <div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div>
      <NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加代理组</NButton>
    </header>
    <div class="collection-toolbar"><NInput v-model:value="query" clearable placeholder="搜索名称、类型或成员" class="collection-search"><template #prefix><Search :size="15" /></template></NInput><span>共 {{ groups.length }} 个代理组</span></div>
    <section v-if="shown.length" class="card-grid group-grid">
      <article v-for="item in shown" :key="`${item.index}-${item.value.name}`" class="item-card structured-card group-card" @dblclick="openEdit(item.index)">
        <div class="item-type">{{ item.value.type || '未设置类型' }}</div>
        <h3>{{ item.value.name || `未命名组 ${item.index + 1}` }}</h3>
        <p>{{ members(item.value) }}</p>
        <div class="group-tags"><span v-for="member in (Array.isArray(item.value.proxies) ? item.value.proxies.slice(0, 3) : [])" :key="String(member)">{{ member }}</span><span v-if="Array.isArray(item.value.proxies) && item.value.proxies.length > 3">+{{ item.value.proxies.length - 3 }}</span></div>
        <div class="card-actions">
          <NButton quaternary circle size="tiny" :disabled="item.index === 0" title="上移" @click="move(item.index, -1)"><template #icon><ArrowUp :size="14" /></template></NButton>
          <NButton quaternary circle size="tiny" :disabled="item.index === groups.length - 1" title="下移" @click="move(item.index, 1)"><template #icon><ArrowDown :size="14" /></template></NButton>
          <NButton quaternary circle size="tiny" title="可视化编辑" @click="openEdit(item.index)"><template #icon><Pencil :size="14" /></template></NButton>
          <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(item.index)"><template #trigger><NButton quaternary circle size="tiny" title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>确定删除这个代理组吗？</NPopconfirm>
        </div>
      </article>
    </section>
    <div v-else class="editor-card empty-state">还没有代理组，点击“添加代理组”开始配置</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex === null ? '添加' : '编辑'}代理组`" class="structured-modal group-modal" :bordered="false">
      <NAlert type="info" :bordered="false">这是完整的可视化表单。导入配置里的协议扩展字段也会原样保留，不会在保存时丢失。</NAlert>
      <div class="visual-form group-form"><ConfigField v-for="field in fields" :key="field.path" :field="field" :model-value="readPath(field.path)" @update:model-value="writePath(field.path, $event)" /></div>
      <template #footer><div class="modal-actions"><NButton @click="dialogOpen = false">取消</NButton><NButton type="primary" @click="save">保存代理组</NButton></div></template>
    </NModal>
  </div>
</template>
