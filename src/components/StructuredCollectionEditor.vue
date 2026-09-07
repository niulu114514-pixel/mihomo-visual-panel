<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NInput, NModal, NPopconfirm, useMessage } from 'naive-ui'
import ConfigField from './ConfigField.vue'
import type { ConfigModuleSchema } from '@/schemas/types'
import { structuredModuleSchemas } from '@/schemas/structured'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const query = ref('')
const dialogOpen = ref(false)
const editingIndex = ref<number | null>(null)
const editingKey = ref('')
const draftName = ref('')
const draft = ref<Record<string, unknown>>({})

const schema = computed(() => structuredModuleSchemas[props.module.id]!)
const rootValue = computed(() => store.get(props.module.rootKey!))

interface ItemView {
  id: string
  index: number
  key: string
  value: unknown
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return clone(value as Record<string, unknown>)
  if (props.module.id === 'tunnels' && typeof value === 'string') {
    const [network = '', address = '', target = '', proxy = ''] = value.split(',').map((part) => part.trim())
    return { network: network.split('/').filter(Boolean), address, target, proxy }
  }
  return {}
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined, value)
}

function writePath(path: string, value: unknown) {
  const next = clone(draft.value)
  const keys = path.split('.')
  let cursor = next
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      if (value === undefined || value === '') delete cursor[key]
      else cursor[key] = value
      return
    }
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  })
  draft.value = next
}

function prune(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(prune)
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, prune(item)] as const)
    .filter(([, item]) => item !== undefined && item !== '' && (!(item && typeof item === 'object' && !Array.isArray(item)) || Object.keys(item as object).length > 0))
  return Object.fromEntries(entries)
}

const items = computed<ItemView[]>(() => {
  if (schema.value.collection === 'map') {
    const record = rootValue.value && typeof rootValue.value === 'object' && !Array.isArray(rootValue.value) ? rootValue.value as Record<string, unknown> : {}
    return Object.entries(record).map(([key, value], index) => ({ id: key, index, key, value }))
  }
  const list = Array.isArray(rootValue.value) ? rootValue.value : []
  return list.map((value, index) => ({ id: `${index}`, index, key: `${index}`, value }))
})

const shown = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((item) => `${item.key} ${JSON.stringify(item.value)}`.toLowerCase().includes(keyword))
})

function openNew() {
  editingIndex.value = null
  editingKey.value = ''
  draftName.value = ''
  draft.value = clone(schema.value.defaults)
  dialogOpen.value = true
}

function openEdit(item: ItemView) {
  editingIndex.value = item.index
  editingKey.value = item.key
  draftName.value = schema.value.collection === 'map' ? item.key : ''
  draft.value = asObject(item.value)
  dialogOpen.value = true
}

function save() {
  const value = prune(draft.value) as Record<string, unknown>
  if (schema.value.collection === 'map') {
    const name = draftName.value.trim()
    if (!name) return message.warning(`请填写${schema.value.nameLabel}`)
    const current = rootValue.value && typeof rootValue.value === 'object' && !Array.isArray(rootValue.value) ? clone(rootValue.value as Record<string, unknown>) : {}
    if (name !== editingKey.value && Object.hasOwn(current, name)) return message.error(`名称“${name}”已经存在`)
    if (editingKey.value) delete current[editingKey.value]
    current[name] = value
    store.setRoot(props.module.rootKey!, current)
  } else {
    const current = Array.isArray(rootValue.value) ? clone(rootValue.value) : []
    if (editingIndex.value === null) current.push(value)
    else current[editingIndex.value] = value
    store.setRoot(props.module.rootKey!, current)
  }
  dialogOpen.value = false
  message.success(`${schema.value.itemLabel}已保存`)
}

function remove(item: ItemView) {
  if (schema.value.collection === 'map') {
    const current = clone((rootValue.value ?? {}) as Record<string, unknown>)
    delete current[item.key]
    store.setRoot(props.module.rootKey!, current)
  } else {
    const current = clone((rootValue.value ?? []) as unknown[])
    current.splice(item.index, 1)
    store.setRoot(props.module.rootKey!, current)
  }
}

function move(item: ItemView, offset: number) {
  if (schema.value.collection !== 'list') return
  const current = clone((rootValue.value ?? []) as unknown[])
  const target = item.index + offset
  if (target < 0 || target >= current.length) return
  ;[current[item.index], current[target]] = [current[target], current[item.index]]
  store.setRoot(props.module.rootKey!, current)
}

function itemObject(item: ItemView) { return asObject(item.value) }
function title(item: ItemView) {
  const value = itemObject(item)
  if (schema.value.collection === 'map') return item.key
  return String(value.name || value.address || `${schema.value.itemLabel} ${item.index + 1}`)
}
function summary(item: ItemView) {
  const value = itemObject(item)
  if (props.module.id === 'listeners') return `${value.type || 'unknown'} · ${value.listen || '0.0.0.0'}:${value.port || '未设置'}`
  if (props.module.id === 'tunnels') return `${Array.isArray(value.network) ? value.network.join('/') : value.network || 'tcp'} · ${value.target || '未设置目标'}`
  return `${value.type || 'unknown'} · ${value.url || value.path || '内联配置'}`
}
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions">
      <div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div>
      <NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加{{ schema.itemLabel }}</NButton>
    </header>
    <div class="collection-toolbar">
      <NInput v-model:value="query" clearable :placeholder="`搜索${module.label}`" class="collection-search" />
      <span>共 {{ items.length }} 项</span>
    </div>
    <section v-if="shown.length" class="card-grid">
      <article v-for="item in shown" :key="item.id" class="item-card structured-card" @dblclick="openEdit(item)">
        <div class="item-type">{{ itemObject(item).type || module.id }}</div>
        <h3>{{ title(item) }}</h3>
        <p>{{ summary(item) }}</p>
        <div class="card-actions">
          <template v-if="schema.collection === 'list'">
            <NButton quaternary circle size="tiny" :disabled="item.index === 0" title="上移" @click="move(item, -1)"><template #icon><ArrowUp :size="13" /></template></NButton>
            <NButton quaternary circle size="tiny" :disabled="item.index === items.length - 1" title="下移" @click="move(item, 1)"><template #icon><ArrowDown :size="13" /></template></NButton>
          </template>
          <NButton quaternary circle size="tiny" title="编辑" @click="openEdit(item)"><template #icon><Pencil :size="13" /></template></NButton>
          <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(item)">
            <template #trigger><NButton quaternary circle size="tiny" title="删除"><template #icon><Trash2 :size="13" /></template></NButton></template>
            确定删除此{{ schema.itemLabel }}吗？
          </NPopconfirm>
        </div>
      </article>
    </section>
    <div v-else class="editor-card empty-state">还没有{{ module.label }}，点击右上角开始添加</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex === null && !editingKey ? '添加' : '编辑'}${schema.itemLabel}`" class="structured-modal" :bordered="false">
      <div class="visual-form">
        <div v-if="schema.collection === 'map'" class="config-field">
          <div class="field-copy"><label>{{ schema.nameLabel }}</label><p>名称必须唯一，引用时使用此名称</p></div>
          <NInput v-model:value="draftName" placeholder="请输入唯一名称" />
        </div>
        <ConfigField v-for="field in schema.fields" :key="field.path" :field="field" :model-value="readPath(draft, field.path)" @update:model-value="writePath(field.path, $event)" />
      </div>
      <NAlert v-if="editingIndex !== null || editingKey" type="info" :bordered="false">表单未展示的协议专属字段会原样保留，可继续通过右侧“源码编辑”处理高级配置。</NAlert>
      <template #footer><div class="modal-actions"><NButton @click="dialogOpen = false">取消</NButton><NButton type="primary" @click="save">保存</NButton></div></template>
    </NModal>
  </div>
</template>
