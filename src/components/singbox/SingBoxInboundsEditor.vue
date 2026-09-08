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
const items = computed(() => records(store.config.inbounds))
const typeOptions = ['mixed', 'tun', 'socks', 'http', 'redirect', 'tproxy'].map((value) => ({ label: value, value }))

const commonFields: ConfigFieldSchema[] = [
  { path: 'tag', label: '入站标签', type: 'text', placeholder: 'mixed-in', description: '建议设置唯一名称，路由规则可通过它匹配' },
  { path: 'listen', label: '监听地址', type: 'text', placeholder: '127.0.0.1' },
  { path: 'listen_port', label: '监听端口', type: 'number', min: 1, max: 65535, placeholder: '2080' },
]
const tunFields: ConfigFieldSchema[] = [
  { path: 'interface_name', label: '虚拟网卡名称', type: 'text', placeholder: 'tun0' },
  { path: 'address', label: '接口地址', type: 'tags', placeholder: '172.18.0.1/30' },
  { path: 'mtu', label: 'MTU', type: 'number', min: 576, max: 9000, placeholder: '9000' },
  { path: 'stack', label: '网络栈', type: 'select', options: ['system', 'gvisor', 'mixed'].map((value) => ({ label: value, value })) },
  { path: 'dns_mode', label: 'DNS 模式', type: 'select', options: ['disabled', 'system', 'hijack'].map((value) => ({ label: value, value })) },
  { path: 'auto_route', label: '自动路由', type: 'switch' },
  { path: 'auto_redirect', label: '自动重定向', type: 'switch' },
  { path: 'strict_route', label: '严格路由', type: 'switch' },
]
const fields = computed(() => draft.value.type === 'tun' ? [commonFields[0]!, ...tunFields] : commonFields)

function defaults(type: string) {
  if (type === 'tun') return { type, tag: 'tun-in', interface_name: 'tun0', address: ['172.18.0.1/30'], mtu: 9000, stack: 'mixed', auto_route: true, strict_route: true }
  const ports: Record<string, number> = { mixed: 2080, socks: 1080, http: 8080, redirect: 7892, tproxy: 7893 }
  return { type, tag: `${type}-in`, listen: '127.0.0.1', listen_port: ports[type] ?? 2080 }
}
function openNew() { editingIndex.value = null; draft.value = defaults('mixed'); dialogOpen.value = true }
function openEdit(index: number) { editingIndex.value = index; draft.value = clone(items.value[index] ?? {}); dialogOpen.value = true }
function changeType(type: string) { draft.value = { ...defaults(type), tag: draft.value.tag || `${type}-in` } }
function patch(path: string, value: unknown) { draft.value = writePath(draft.value, path, value) }
function save() {
  const tag = String(draft.value.tag || '').trim()
  if (!tag) return message.warning('请填写入站标签')
  if (items.value.some((item, index) => index !== editingIndex.value && item.tag === tag)) return message.error(`入站标签“${tag}”已经存在`)
  const next = clone(items.value)
  const value = { ...draft.value, tag }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.setRoot('inbounds', next)
  dialogOpen.value = false
  message.success('入站已保存')
}
function remove(index: number) { const next = clone(items.value); next.splice(index, 1); store.setRoot('inbounds', next) }
function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= items.value.length) return; const next = clone(items.value); [next[index], next[target]] = [next[target]!, next[index]!]; store.setRoot('inbounds', next) }
</script>

<template>
  <section class="singbox-module-panel">
    <header class="singbox-module-heading"><div><h2>入站</h2><p>添加本地代理端口或 TUN 网卡。协议专属的高级字段在编辑时会继续保留。</p></div><NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加入站</NButton></header>
    <div v-if="items.length" class="singbox-card-grid"><article v-for="(item,index) in items" :key="`${item.tag}-${index}`" class="item-card structured-card singbox-item-card"><div class="item-type">{{ item.type }}</div><h3>{{ item.tag || `未命名入站 ${index + 1}` }}</h3><p>{{ item.type === 'tun' ? (item.interface_name || '自动网卡') : `${item.listen || '::'}:${item.listen_port || '未设置'}` }}</p><div class="card-actions"><NButton quaternary circle :disabled="index === 0" title="上移" @click="move(index,-1)"><template #icon><ArrowUp :size="14" /></template></NButton><NButton quaternary circle :disabled="index === items.length - 1" title="下移" @click="move(index,1)"><template #icon><ArrowDown :size="14" /></template></NButton><NButton quaternary circle title="可视化编辑" @click="openEdit(index)"><template #icon><Pencil :size="14" /></template></NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(index)"><template #trigger><NButton quaternary circle title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>确定删除这个入站吗？</NPopconfirm></div></article></div>
    <div v-else class="editor-card empty-state">还没有入站，可添加 Mixed 端口或 TUN 网卡</div>
    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex === null ? '添加' : '编辑'}入站`" class="structured-modal singbox-visual-modal" :bordered="false"><NAlert type="info" :bordered="false">切换协议类型会载入该类型的安全默认值；不切换类型时，未展示字段会原样保留。</NAlert><div class="visual-form singbox-modal-form"><div class="config-field"><div class="field-copy"><label>入站类型</label><p>常用客户端入站类型</p></div><NSelect :value="String(draft.type || 'mixed')" :options="typeOptions" @update:value="changeType" /></div><ConfigField v-for="field in fields" :key="field.path" :field="field" :model-value="readPath(draft,field.path)" @update:model-value="patch(field.path,$event)" /></div><template #footer><div class="modal-actions"><NButton @click="dialogOpen=false">取消</NButton><NButton type="primary" @click="save">保存入站</NButton></div></template></NModal>
  </section>
</template>
