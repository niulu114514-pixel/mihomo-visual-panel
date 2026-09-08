<script setup lang="ts">
import { computed, ref } from 'vue'
import { ClipboardPaste, ExternalLink, Plus, Search, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NCollapse, NCollapseItem, NInput, NModal, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import ConfigField from './ConfigField.vue'
import VisualValueEditor from './VisualValueEditor.vue'
import type { ConfigFieldSchema, ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'
import { parseProxyInput } from '@/utils/proxy-import'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const query = ref('')
const dialogOpen = ref(false)
const importOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draft = ref<Record<string, unknown>>({})
const importSource = ref('')
const importError = ref('')

const rawItems = computed(() => Array.isArray(store.get(props.module.rootKey!)) ? store.get(props.module.rootKey!) as unknown[] : [])
const items = computed(() => rawItems.value.flatMap((value, index) => value && typeof value === 'object' && !Array.isArray(value)
  ? [{ value: value as Record<string, unknown>, index }]
  : []))
const shown = computed(() => items.value.filter(({ value }) => `${value.name || ''} ${value.type || ''} ${value.server || ''}`.toLowerCase().includes(query.value.trim().toLowerCase())))

const proxyTypes = ['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'wireguard', 'socks5', 'http', 'snell', 'ssh', 'mieru', 'anytls', 'shadowquic', 'direct', 'dns'].map((value) => ({ label: value, value }))
const commonFields: ConfigFieldSchema[] = [
  { path: 'name', label: '节点名称', type: 'text', placeholder: '唯一名称', description: '代理组和路由规则通过此名称引用' },
  { path: 'server', label: '服务器', type: 'text', placeholder: 'example.com' },
  { path: 'port', label: '端口', type: 'number', min: 1, max: 65535, placeholder: '443' },
]
const protocolFields: Record<string, ConfigFieldSchema[]> = {
  ss: [
    { path: 'cipher', label: '加密方式', type: 'text', placeholder: 'aes-128-gcm' },
    { path: 'password', label: '密码', type: 'text' },
    { path: 'udp', label: 'UDP', type: 'switch' },
    { path: 'plugin', label: '插件', type: 'text', placeholder: 'v2ray-plugin' },
  ],
  ssr: [
    { path: 'cipher', label: '加密方式', type: 'text' }, { path: 'password', label: '密码', type: 'text' },
    { path: 'protocol', label: '协议', type: 'text' }, { path: 'protocol-param', label: '协议参数', type: 'text' },
    { path: 'obfs', label: '混淆', type: 'text' }, { path: 'obfs-param', label: '混淆参数', type: 'text' },
  ],
  vmess: [
    { path: 'uuid', label: 'UUID', type: 'text' }, { path: 'alterId', label: 'Alter ID', type: 'number', min: 0 },
    { path: 'cipher', label: '加密方式', type: 'select', options: ['auto', 'none', 'zero'].map((value) => ({ label: value, value })) },
    { path: 'network', label: '传输层', type: 'select', options: ['tcp', 'ws', 'http', 'h2', 'grpc'].map((value) => ({ label: value, value })) },
    { path: 'tls', label: 'TLS', type: 'switch' }, { path: 'servername', label: 'TLS 服务器名称', type: 'text' },
    { path: 'skip-cert-verify', label: '跳过证书验证', type: 'switch' },
  ],
  vless: [
    { path: 'uuid', label: 'UUID', type: 'text' }, { path: 'flow', label: 'Flow', type: 'text', placeholder: 'xtls-rprx-vision' },
    { path: 'network', label: '传输层', type: 'select', options: ['tcp', 'ws', 'grpc'].map((value) => ({ label: value, value })) },
    { path: 'tls', label: 'TLS', type: 'switch' }, { path: 'servername', label: 'TLS 服务器名称', type: 'text' },
    { path: 'reality-opts.public-key', label: 'Reality 公钥', type: 'text' }, { path: 'reality-opts.short-id', label: 'Reality Short ID', type: 'text' },
  ],
  trojan: [
    { path: 'password', label: '密码', type: 'text' }, { path: 'network', label: '传输层', type: 'select', options: ['tcp', 'ws', 'grpc'].map((value) => ({ label: value, value })) },
    { path: 'sni', label: 'SNI', type: 'text' }, { path: 'skip-cert-verify', label: '跳过证书验证', type: 'switch' },
  ],
  hysteria: [
    { path: 'auth-str', label: '认证字符串', type: 'text' }, { path: 'ports', label: '端口跳跃范围', type: 'text', placeholder: '20000-30000' },
    { path: 'up', label: '上行速率', type: 'text', placeholder: '50 Mbps' }, { path: 'down', label: '下行速率', type: 'text', placeholder: '200 Mbps' },
    { path: 'sni', label: 'SNI', type: 'text' }, { path: 'skip-cert-verify', label: '跳过证书验证', type: 'switch' },
  ],
  hysteria2: [
    { path: 'password', label: '密码', type: 'text' }, { path: 'ports', label: '端口跳跃范围', type: 'text', placeholder: '20000-30000' },
    { path: 'up', label: '上行速率', type: 'text' }, { path: 'down', label: '下行速率', type: 'text' },
    { path: 'obfs', label: '混淆类型', type: 'text', placeholder: 'salamander' }, { path: 'obfs-password', label: '混淆密码', type: 'text' },
    { path: 'sni', label: 'SNI', type: 'text' }, { path: 'skip-cert-verify', label: '跳过证书验证', type: 'switch' },
  ],
  tuic: [
    { path: 'uuid', label: 'UUID', type: 'text' }, { path: 'password', label: '密码', type: 'text' }, { path: 'token', label: 'Token（v4）', type: 'text' },
    { path: 'congestion-controller', label: '拥塞控制', type: 'select', options: ['cubic', 'new_reno', 'bbr'].map((value) => ({ label: value, value })) },
    { path: 'udp-relay-mode', label: 'UDP 中继模式', type: 'select', options: ['native', 'quic'].map((value) => ({ label: value, value })) },
    { path: 'sni', label: 'SNI', type: 'text' }, { path: 'alpn', label: 'ALPN', type: 'tags', placeholder: 'h3' },
  ],
  wireguard: [
    { path: 'ip', label: '本地 IPv4', type: 'text' }, { path: 'ipv6', label: '本地 IPv6', type: 'text' },
    { path: 'private-key', label: '私钥', type: 'text' }, { path: 'public-key', label: '对端公钥', type: 'text' },
    { path: 'pre-shared-key', label: '预共享密钥', type: 'text' }, { path: 'reserved', label: 'Reserved', type: 'tags', placeholder: '0' },
    { path: 'mtu', label: 'MTU', type: 'number', min: 576, max: 9000 },
  ],
  socks5: [{ path: 'username', label: '用户名', type: 'text' }, { path: 'password', label: '密码', type: 'text' }, { path: 'tls', label: 'TLS', type: 'switch' }, { path: 'udp', label: 'UDP', type: 'switch' }],
  http: [{ path: 'username', label: '用户名', type: 'text' }, { path: 'password', label: '密码', type: 'text' }, { path: 'tls', label: 'TLS', type: 'switch' }, { path: 'sni', label: 'SNI', type: 'text' }],
  snell: [{ path: 'psk', label: 'PSK', type: 'text' }, { path: 'version', label: '版本', type: 'number', min: 1 }, { path: 'obfs-opts.mode', label: '混淆模式', type: 'text' }, { path: 'obfs-opts.host', label: '混淆 Host', type: 'text' }],
  ssh: [{ path: 'username', label: '用户名', type: 'text' }, { path: 'password', label: '密码', type: 'text' }, { path: 'private-key', label: '私钥内容/路径', type: 'textarea' }, { path: 'host-key-algorithms', label: 'Host Key 算法', type: 'tags' }],
  mieru: [{ path: 'username', label: '用户名', type: 'text' }, { path: 'password', label: '密码', type: 'text' }, { path: 'port-range', label: '端口范围', type: 'text' }, { path: 'transport', label: '传输协议', type: 'select', options: ['TCP'].map((value) => ({ label: value, value })) }],
  anytls: [{ path: 'password', label: '密码', type: 'text' }, { path: 'client-fingerprint', label: '客户端指纹', type: 'text' }, { path: 'idle-session-check-interval', label: '空闲会话检查', type: 'number', min: 0 }],
}
const visibleFields = computed(() => {
  const type = String(draft.value.type || '')
  if (['direct', 'dns'].includes(type)) return [commonFields[0]!]
  return [...commonFields, ...(protocolFields[type] ?? [])]
})

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function readPath(path: string) { return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, draft.value) }
function patch(path: string, value: unknown) {
  const next = clone(draft.value)
  const keys = path.split('.')
  let cursor = next
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      if (value === undefined || value === null || value === '') delete cursor[key]
      else cursor[key] = value
    } else {
      if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
      cursor = cursor[key] as Record<string, unknown>
    }
  })
  draft.value = next
}
function openNew() { editingIndex.value = null; draft.value = { name: '', type: 'ss', server: '', port: 443, cipher: 'aes-128-gcm', password: '', udp: true }; dialogOpen.value = true }
function openEdit(index: number) {
  const value = rawItems.value[index]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  editingIndex.value = index
  draft.value = clone(value as Record<string, unknown>)
  dialogOpen.value = true
}
function save() {
  const name = String(draft.value.name || '').trim()
  if (!name) return message.warning('请填写节点名称')
  if (!draft.value.type) return message.warning('请选择节点类型')
  if (items.value.some((item) => item.index !== editingIndex.value && item.value.name === name)) return message.error(`节点“${name}”已经存在`)
  const next = clone(rawItems.value)
  const value = { ...draft.value, name }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.setRoot(props.module.rootKey!, next)
  dialogOpen.value = false
  message.success('代理节点已保存')
}
function remove(index: number) { store.setRoot(props.module.rootKey!, rawItems.value.filter((_, itemIndex) => itemIndex !== index)) }
function uniqueName(value: Record<string, unknown>, used: Set<string>) {
  const original = String(value.name || `${value.type || 'proxy'}-${used.size + 1}`)
  let name = original
  let suffix = 2
  while (used.has(name)) name = `${original}-${suffix++}`
  used.add(name)
  return { ...value, name }
}
function importNodes() {
  try {
    const parsed = parseProxyInput(importSource.value, 'mihomo')
    if (!parsed.length) throw new Error('没有识别到代理节点')
    const used = new Set(items.value.map((item) => String(item.value.name || '')).filter(Boolean))
    const next = [...clone(rawItems.value), ...parsed.map((item) => uniqueName(item, used))]
    store.setRoot(props.module.rootKey!, next)
    importOpen.value = false
    importSource.value = ''
    importError.value = ''
    message.success(`已导入 ${parsed.length} 个代理节点`)
  } catch (cause) { importError.value = cause instanceof Error ? cause.message : '节点导入失败' }
}
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions">
      <div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div>
      <div class="heading-actions"><NButton secondary @click="importOpen = true"><template #icon><ClipboardPaste :size="15" /></template>粘贴导入</NButton><NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加节点</NButton></div>
    </header>
    <div class="collection-toolbar"><NInput v-model:value="query" clearable :placeholder="`搜索${module.label}`" class="collection-search"><template #prefix><Search :size="15" /></template></NInput><span>共 {{ items.length }} 项</span></div>
    <section v-if="shown.length" class="card-grid"><article v-for="item in shown" :key="item.index" class="item-card editable-card" tabindex="0" @click="openEdit(item.index)" @keydown.enter.self="openEdit(item.index)"><div class="item-type">{{ item.value.type || 'unknown' }}</div><h3>{{ item.value.name || `未命名 ${item.index + 1}` }}</h3><p>{{ item.value.server || '本地/内置出站' }}<span v-if="item.value.port">:{{ item.value.port }}</span></p><NButton size="tiny" class="edit-chip" @click.stop="openEdit(item.index)">编辑</NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(item.index)"><template #trigger><NButton quaternary circle size="small" class="danger-icon" title="删除" @click.stop><template #icon><Trash2 :size="15" /></template></NButton></template>删除后引用此节点的代理组会报错，确定继续吗？</NPopconfirm></article></section>
    <div v-else class="editor-card empty-state">还没有代理节点，可添加或粘贴订阅节点</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex === null ? '添加' : '编辑'}代理节点`" class="structured-modal node-modal" :bordered="false">
      <NAlert type="info" :bordered="false">常用字段使用专用表单；“全部字段”支持任意嵌套对象、数组和类型，可完整编辑协议扩展字段。</NAlert>
      <div class="visual-form node-form">
        <div class="config-field"><div class="field-copy"><label>节点类型</label><p>覆盖 Mihomo 当前全部内置代理类型</p></div><NSelect filterable tag :value="String(draft.type || 'ss')" :options="proxyTypes" @update:value="patch('type',$event)" /></div>
        <ConfigField v-for="field in visibleFields" :key="field.path" :field="field" :model-value="readPath(field.path)" @update:model-value="patch(field.path,$event)" />
      </div>
      <NCollapse class="full-field-collapse"><NCollapseItem title="全部字段（完整可视化）" name="all"><VisualValueEditor v-model="draft" root /></NCollapseItem></NCollapse>
      <template #footer><div class="modal-actions"><NButton @click="dialogOpen = false">取消</NButton><NButton type="primary" @click="save">保存节点</NButton></div></template>
    </NModal>

    <NModal v-model:show="importOpen" preset="card" title="粘贴/批量导入代理节点" class="structured-modal import-modal" :bordered="false">
      <NAlert type="info" :bordered="false">支持完整 Clash/Mihomo YAML、proxies 数组、sing-box outbounds、单个 YAML 对象，以及每行一个 ss / vmess / vless / trojan / hysteria2 / tuic / socks / http / anytls 分享链接。</NAlert>
      <NInput v-model:value="importSource" type="textarea" class="mono-input import-source" :autosize="{ minRows: 14, maxRows: 24 }" placeholder="粘贴 YAML、JSON 或分享链接；多个链接每行一个" />
      <p v-if="importError" class="inline-error">{{ importError }}</p>
      <template #footer><div class="modal-actions"><NButton @click="importOpen = false">取消</NButton><NButton type="primary" :disabled="!importSource.trim()" @click="importNodes">解析并导入</NButton></div></template>
    </NModal>
  </div>
</template>
