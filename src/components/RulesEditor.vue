<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, GripVertical, Plus, Search, Trash2 } from '@lucide/vue'
import { NButton, NCheckbox, NInput, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

type RuleRow = {
  index: number
  source: string
  type: string
  payload: string
  target: string
  noResolve: boolean
}

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const query = ref('')
const dragIndex = ref<number | null>(null)

const ruleTypes = [
  ['DOMAIN', '域名完整匹配'], ['DOMAIN-SUFFIX', '域名后缀匹配'], ['DOMAIN-KEYWORD', '域名关键词匹配'],
  ['DOMAIN-REGEX', '域名正则匹配'], ['GEOSITE', 'GeoSite 集合'], ['IP-CIDR', 'IPv4 网段匹配'],
  ['IP-CIDR6', 'IPv6 网段匹配'], ['IP-SUFFIX', 'IP 后缀匹配'], ['IP-ASN', 'IP ASN 匹配'],
  ['GEOIP', 'GeoIP 国家或地区'], ['SRC-IP-CIDR', '来源 IP 网段'], ['SRC-IP-SUFFIX', '来源 IP 后缀'],
  ['SRC-PORT', '来源端口'], ['DST-PORT', '目标端口'], ['IN-PORT', '入站端口'],
  ['IN-TYPE', '入站类型'], ['IN-USER', '入站用户'], ['IN-NAME', '入站名称'],
  ['PROCESS-PATH', '进程路径'], ['PROCESS-PATH-REGEX', '进程路径正则'], ['PROCESS-NAME', '进程名称'],
  ['PROCESS-NAME-REGEX', '进程名称正则'], ['UID', '用户 ID'], ['NETWORK', '网络协议'],
  ['DSCP', 'DSCP 标记'], ['RULE-SET', '规则集合'], ['SUB-RULE', '子规则'],
  ['AND', '逻辑与（所有条件满足）'], ['OR', '逻辑或（任一条件满足）'], ['NOT', '逻辑非'],
  ['MATCH', '最终匹配'],
] as const

const baseTypeOptions = ruleTypes.map(([value, name]) => ({ value, label: `${value} ${name}` }))
const noResolveTypes = new Set(['IP-CIDR', 'IP-CIDR6', 'IP-SUFFIX', 'IP-ASN', 'GEOIP', 'SRC-IP-CIDR', 'SRC-IP-SUFFIX'])
const rules = computed(() => Array.isArray(store.get(props.module.rootKey!)) ? store.get(props.module.rootKey!) as unknown[] : [])

function splitRule(source: string) {
  const tokens: string[] = []
  let buffer = ''
  let depth = 0
  let quote = ''
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!
    if (quote) {
      buffer += char
      if (char === quote && source[index - 1] !== '\\') quote = ''
      continue
    }
    if (char === '"' || char === "'") { quote = char; buffer += char; continue }
    if (char === '(' || char === '[' || char === '{') depth += 1
    if (char === ')' || char === ']' || char === '}') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) { tokens.push(buffer.trim()); buffer = ''; continue }
    buffer += char
  }
  tokens.push(buffer.trim())
  return tokens
}

function parseRule(value: unknown, index: number): RuleRow {
  const source = String(value)
  const tokens = splitRule(source)
  const type = (tokens.shift() || 'DOMAIN-SUFFIX').toUpperCase()
  const noResolve = tokens.at(-1)?.toLowerCase() === 'no-resolve'
  if (noResolve) tokens.pop()
  const target = tokens.pop() || 'DIRECT'
  return { index, source, type, payload: tokens.join(','), target, noResolve }
}

const rows = computed(() => rules.value.map(parseRule))
const shown = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return keyword ? rows.value.filter((item) => item.source.toLowerCase().includes(keyword)) : rows.value
})

const targetOptions = computed(() => {
  const values = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE'])
  for (const key of ['proxy-groups', 'proxies']) {
    const items = store.get(key)
    if (!Array.isArray(items)) continue
    for (const item of items) {
      if (item && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>).name) {
        values.add(String((item as Record<string, unknown>).name))
      }
    }
  }
  for (const row of rows.value) if (row.target) values.add(row.target)
  return [...values].map((value) => ({ value, label: value }))
})

function typeOptions(current: string) {
  return baseTypeOptions.some((item) => item.value === current)
    ? baseTypeOptions
    : [{ value: current, label: `${current} 自定义规则` }, ...baseTypeOptions]
}

function serialize(row: Pick<RuleRow, 'type' | 'payload' | 'target' | 'noResolve'>) {
  const parts = [row.type]
  if (row.type !== 'MATCH' || row.payload) parts.push(row.payload)
  parts.push(row.target || 'DIRECT')
  if (row.noResolve) parts.push('no-resolve')
  return parts.join(',')
}

function patchRule(row: RuleRow, patch: Partial<RuleRow>) {
  const nextRow = { ...row, ...patch }
  const next = [...rules.value]
  next[row.index] = serialize(nextRow)
  store.setRoot(props.module.rootKey!, next)
}

function add() {
  store.setRoot(props.module.rootKey!, [...rules.value, 'DOMAIN-SUFFIX,example.com,DIRECT'])
  message.success('已添加规则')
}

function remove(index: number) {
  store.setRoot(props.module.rootKey!, rules.value.filter((_, itemIndex) => itemIndex !== index))
}

function move(from: number, to: number) {
  if (from === to) return
  const next = [...rules.value]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return
  next.splice(to, 0, moved)
  store.setRoot(props.module.rootKey!, next)
}

function dropOn(index: number) {
  if (dragIndex.value !== null) move(dragIndex.value, index)
  dragIndex.value = null
}
</script>

<template>
  <div class="module-content rules-module">
    <header class="module-heading">
      <div>
        <h1>{{ module.label }}</h1>
        <p>{{ module.description }} 每条规则由「类型 + 匹配参数 + 目标策略」组成 <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="14" /></a></p>
      </div>
    </header>

    <div class="rules-toolbar">
      <div class="rules-toolbar__left">
        <NButton type="primary" @click="add"><template #icon><Plus :size="17" /></template>添加规则</NButton>
        <span>共 {{ rules.length }} 条规则</span>
      </div>
      <NInput v-model:value="query" clearable placeholder="搜索规则" class="collection-search">
        <template #prefix><Search :size="16" /></template>
      </NInput>
    </div>

    <section class="editor-card rules-card">
      <div class="rules-table-scroll">
        <div class="rules-table rules-table--header">
          <span /><span>#</span><span>规则类型</span><span>匹配参数</span><span>目标策略</span><span>选项</span><span />
        </div>
        <div v-if="shown.length" class="rules-body">
          <div
            v-for="row in shown"
            :key="row.index"
            class="rules-table rules-row"
            :class="{ dragging: dragIndex === row.index }"
            @dragover.prevent
            @drop="dropOn(row.index)"
          >
            <span class="rule-grip" draggable="true" title="拖动排序" @dragstart="dragIndex = row.index" @dragend="dragIndex = null"><GripVertical :size="17" /></span>
            <span class="row-index">{{ row.index + 1 }}</span>
            <NSelect :value="row.type" :options="typeOptions(row.type)" filterable @update:value="patchRule(row, { type: String($event) })" />
            <NInput :value="row.payload" :disabled="row.type === 'MATCH'" :placeholder="row.type === 'MATCH' ? '无需参数' : '输入匹配参数'" @update:value="patchRule(row, { payload: $event })" />
            <NSelect :value="row.target" :options="targetOptions" filterable tag @update:value="patchRule(row, { target: String($event) })" />
            <NCheckbox :checked="row.noResolve" :disabled="!noResolveTypes.has(row.type) && !row.noResolve" @update:checked="patchRule(row, { noResolve: $event })">no-resolve</NCheckbox>
            <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(row.index)">
              <template #trigger><NButton quaternary circle title="删除规则"><template #icon><Trash2 :size="17" /></template></NButton></template>
              确定删除这条规则吗？
            </NPopconfirm>
          </div>
        </div>
        <div v-else class="empty-state">{{ query ? '没有匹配的规则' : '暂无规则，点击上方按钮添加' }}</div>
      </div>
    </section>
  </div>
</template>
