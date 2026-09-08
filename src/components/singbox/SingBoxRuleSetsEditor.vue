<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NInput, NModal, NPopconfirm, NSelect, useMessage } from 'naive-ui'
import ConfigField from '@/components/ConfigField.vue'
import { useSingBoxStore } from '@/stores/singbox'
import { clone, records, writePath } from './helpers'

interface RuleSetTemplate { tag: string; label: string; description: string; repo: 'geosite' | 'geoip' }
const templates: RuleSetTemplate[] = [
  { tag: 'geosite-private', label: '私有域名', description: '局域网与私有域名', repo: 'geosite' },
  { tag: 'geoip-private', label: '私有地址', description: '私有 IP 地址段', repo: 'geoip' },
  { tag: 'geosite-category-ads-all', label: '广告域名', description: '常见广告与追踪域名', repo: 'geosite' },
  { tag: 'geosite-cn', label: '中国域名', description: '中国大陆常用域名', repo: 'geosite' },
  { tag: 'geoip-cn', label: '中国 IP', description: '中国大陆 IP 地址段', repo: 'geoip' },
  { tag: 'geosite-geolocation-!cn', label: '非中国域名', description: '常见境外域名', repo: 'geosite' },
  { tag: 'geosite-openai', label: 'OpenAI', description: 'OpenAI 相关域名', repo: 'geosite' },
  { tag: 'geosite-google', label: 'Google', description: 'Google 服务域名', repo: 'geosite' },
  { tag: 'geosite-youtube', label: 'YouTube', description: 'YouTube 服务域名', repo: 'geosite' },
  { tag: 'geosite-github', label: 'GitHub', description: 'GitHub 相关域名', repo: 'geosite' },
  { tag: 'geosite-telegram', label: 'Telegram', description: 'Telegram 服务域名', repo: 'geosite' },
  { tag: 'geoip-telegram', label: 'Telegram IP', description: 'Telegram IP 地址段', repo: 'geoip' },
  { tag: 'geosite-microsoft', label: 'Microsoft', description: 'Microsoft 服务域名', repo: 'geosite' },
  { tag: 'geosite-apple', label: 'Apple', description: 'Apple 服务域名', repo: 'geosite' },
  { tag: 'geosite-netflix', label: 'Netflix', description: 'Netflix 流媒体域名', repo: 'geosite' },
  { tag: 'geosite-disney', label: 'Disney+', description: 'Disney+ 流媒体域名', repo: 'geosite' },
  { tag: 'geosite-spotify', label: 'Spotify', description: 'Spotify 音乐服务域名', repo: 'geosite' },
  { tag: 'geosite-steam', label: 'Steam', description: 'Steam 游戏平台域名', repo: 'geosite' },
]

const store = useSingBoxStore()
const message = useMessage()
const dialogOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draft = ref<Record<string, unknown>>({})
const items = computed(() => records(store.get('route.rule_set')))
const existingTags = computed(() => new Set(items.value.flatMap((item) => Array.isArray(item.tag) ? item.tag.map(String) : [String(item.tag || '')])))
const httpClients = computed(() => records(store.config.http_clients).map((item) => String(item.tag || '')).filter(Boolean).map((value) => ({ label: value, value })))

function remoteUrl(template: RuleSetTemplate) { return `https://raw.githubusercontent.com/SagerNet/sing-${template.repo}/rule-set/${template.tag}.srs` }
function ensureRuleSetDownloader() {
  const clients = records(store.config.http_clients)
  if (clients.length) {
    const firstTag = String(clients[0]?.tag || '')
    if (!store.get('route.default_http_client') && firstTag) store.set('route.default_http_client', firstTag)
    return
  }
  store.setRoot('http_clients', [{ tag: 'rule-set-download', engine: 'go' }])
  store.set('route.default_http_client', 'rule-set-download')
}
function openNew() { editingIndex.value = null; draft.value = { type: 'remote', tag: '', format: 'binary', url: '', update_interval: '1d' }; dialogOpen.value = true }
function openEdit(index: number) { editingIndex.value = index; draft.value = clone(items.value[index] ?? {}); dialogOpen.value = true }
function changeType(type: string) { const tag = draft.value.tag || ''; draft.value = type === 'inline' ? { type, tag, rules: [] } : { type, tag, format: 'binary', ...(type === 'remote' ? { url: '', update_interval: '1d' } : { path: '' }) } }
function patch(path: string, value: unknown) { draft.value = writePath(draft.value, path, value) }
function addTemplate(template: RuleSetTemplate) {
  if (existingTags.value.has(template.tag)) return message.info(`${template.label}规则集已经存在`)
  ensureRuleSetDownloader()
  store.set('route.rule_set', [...items.value, { type: 'remote', tag: template.tag, format: 'binary', url: remoteUrl(template), update_interval: '1d' }])
  message.success(`已添加“${template.label}”规则集`)
}
function save() {
  const tag = String(draft.value.tag || '').trim()
  if (!tag) return message.warning('请填写规则集标签')
  if (items.value.some((item, index) => index !== editingIndex.value && (Array.isArray(item.tag) ? item.tag.includes(tag) : item.tag === tag))) return message.error(`规则集“${tag}”已经存在`)
  const next = clone(items.value)
  const value = { ...draft.value, tag }
  if (editingIndex.value === null) next.push(value)
  else next[editingIndex.value] = value
  store.set('route.rule_set', next)
  dialogOpen.value = false
  message.success('规则集已保存')
}
function remove(index: number) { const next = clone(items.value); next.splice(index, 1); store.set('route.rule_set', next) }
function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= items.value.length) return; const next = clone(items.value); [next[index],next[target]]=[next[target]!,next[index]!]; store.set('route.rule_set',next) }
</script>

<template>
  <section class="singbox-module-panel">
    <header class="singbox-module-heading"><div><h2>规则集</h2><p>可一键加入常见规则集，也可以维护远程、本地和内联规则集。</p></div><NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>自定义规则集</NButton></header>
    <section class="rule-template-panel"><header><Sparkles :size="16" /><div><strong>常用规则集</strong><span>点击即可加入配置；首次添加会建立 sing-box 1.14 下载器</span></div></header><div class="rule-template-grid"><button v-for="template in templates" :key="template.tag" :class="{added:existingTags.has(template.tag)}" @click="addTemplate(template)"><span>{{ template.label }}</span><small>{{ existingTags.has(template.tag) ? '已添加' : template.description }}</small></button></div></section>
    <div v-if="items.length" class="singbox-card-grid"><article v-for="(item,index) in items" :key="`${item.tag}-${index}`" class="item-card structured-card singbox-item-card"><div class="item-type">{{ item.type }}</div><h3>{{ Array.isArray(item.tag) ? item.tag.join(' / ') : item.tag }}</h3><p>{{ item.type === 'remote' ? item.url : item.type === 'local' ? item.path : `${Array.isArray(item.rules)?item.rules.length:0} 条内联规则` }}</p><div class="card-actions"><NButton quaternary circle :disabled="index===0" title="上移" @click="move(index,-1)"><template #icon><ArrowUp :size="14" /></template></NButton><NButton quaternary circle :disabled="index===items.length-1" title="下移" @click="move(index,1)"><template #icon><ArrowDown :size="14" /></template></NButton><NButton quaternary circle title="可视化编辑" @click="openEdit(index)"><template #icon><Pencil :size="14" /></template></NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(index)"><template #trigger><NButton quaternary circle title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>引用此规则集的路由会报错，确定删除吗？</NPopconfirm></div></article></div>
    <div v-else class="editor-card empty-state">尚未添加规则集，可先从上方常用模板中选择</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex===null?'添加':'编辑'}规则集`" class="structured-modal singbox-visual-modal" :bordered="false"><NAlert type="info" :bordered="false">远程二进制规则集使用 .srs；1.14 推荐通过 HTTP Client 控制下载路径。</NAlert><div class="visual-form singbox-modal-form"><div class="config-field"><div class="field-copy"><label>规则集类型</label><p>远程、本地文件或内联规则</p></div><NSelect :value="String(draft.type||'remote')" :options="['remote','local','inline'].map(value=>({label:value,value}))" @update:value="changeType" /></div><ConfigField :field="{path:'tag',label:'规则集标签',type:'text',placeholder:'geosite-cn',description:'必须唯一，路由规则通过标签引用'}" :model-value="draft.tag" @update:model-value="patch('tag',$event)" /><template v-if="draft.type!=='inline'"><ConfigField :field="{path:'format',label:'文件格式',type:'select',options:['binary','source'].map(value=>({label:value,value}))}" :model-value="draft.format" @update:model-value="patch('format',$event)" /></template><template v-if="draft.type==='remote'"><ConfigField :field="{path:'url',label:'远程地址',type:'text',placeholder:'https://example.com/rules.srs'}" :model-value="draft.url" @update:model-value="patch('url',$event)" /><ConfigField :field="{path:'initial_path',label:'初始文件路径',type:'text',placeholder:'./rules/default.srs'}" :model-value="draft.initial_path" @update:model-value="patch('initial_path',$event)" /><ConfigField :field="{path:'update_interval',label:'更新间隔',type:'text',placeholder:'1d'}" :model-value="draft.update_interval" @update:model-value="patch('update_interval',$event)" /><div class="config-field"><div class="field-copy"><label>HTTP Client</label><p>可选已有的下载客户端</p></div><NSelect clearable filterable tag :value="draft.http_client ? String(draft.http_client) : null" :options="httpClients" placeholder="使用默认客户端" @update:value="patch('http_client',$event)" /></div></template><ConfigField v-if="draft.type==='local'" :field="{path:'path',label:'本地路径',type:'text',placeholder:'./rules/local.srs'}" :model-value="draft.path" @update:model-value="patch('path',$event)" /><div v-if="draft.type==='inline'" class="config-field config-field--wide"><div class="field-copy"><label>内联规则</label><p>复杂 Headless Rule 建议在源码页编辑，已有内容会保留</p></div><NInput type="textarea" readonly :value="JSON.stringify(draft.rules||[],null,2)" :autosize="{minRows:4,maxRows:10}" /></div></div><template #footer><div class="modal-actions"><NButton @click="dialogOpen=false">取消</NButton><NButton type="primary" @click="save">保存规则集</NButton></div></template></NModal>
  </section>
</template>


