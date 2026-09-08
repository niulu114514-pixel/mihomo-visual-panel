<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@lucide/vue'
import { NAlert, NButton, NModal, NPopconfirm, NSelect, NSwitch, useMessage } from 'naive-ui'
import ConfigField from '@/components/ConfigField.vue'
import { useSingBoxStore } from '@/stores/singbox'
import { clone, records, writePath } from './helpers'

const store = useSingBoxStore()
const message = useMessage()
const dialogOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draft = ref<Record<string, unknown>>({})
const items = computed(() => records(store.get('route.rules')))
const options = (values: string[]) => values.map((value) => ({ label: value, value }))
const outboundOptions = computed(() => options(records(store.config.outbounds).map((item) => String(item.tag || '')).filter(Boolean)))
const inboundOptions = computed(() => options(records(store.config.inbounds).map((item) => String(item.tag || '')).filter(Boolean)))
const ruleSetOptions = computed(() => options(records(store.get('route.rule_set')).flatMap((item) => Array.isArray(item.tag) ? item.tag.map(String) : [String(item.tag || '')]).filter(Boolean)))

function openNew() { editingIndex.value = null; draft.value = { action: 'route', outbound: String(store.get('route.final') || outboundOptions.value[0]?.value || '') }; dialogOpen.value = true }
function openEdit(index: number) { editingIndex.value = index; draft.value = clone(items.value[index] ?? {}); dialogOpen.value = true }
function patch(path: string, value: unknown) { draft.value = writePath(draft.value, path, value) }
function changeAction(action: string) {
  const next = clone(draft.value)
  next.action = action
  if (action !== 'route' && action !== 'bypass') delete next.outbound
  if (action !== 'reject') { delete next.method; delete next.no_drop }
  draft.value = next
}
function save() {
  if ((draft.value.action === 'route' || !draft.value.action) && !draft.value.outbound) return message.warning('请选择目标出站')
  const next = clone(items.value)
  if (editingIndex.value === null) next.push(clone(draft.value))
  else next[editingIndex.value] = clone(draft.value)
  store.set('route.rules', next)
  dialogOpen.value = false
  message.success('路由规则已保存')
}
function remove(index: number) { const next = clone(items.value); next.splice(index, 1); store.set('route.rules', next) }
function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= items.value.length) return; const next = clone(items.value); [next[index],next[target]]=[next[target]!,next[index]!]; store.set('route.rules',next) }
function list(value: unknown) { return Array.isArray(value) ? value.map(String) : value ? [String(value)] : [] }
function describe(item: Record<string, unknown>) {
  const conditions: string[] = []
  if (item.rule_set) conditions.push(`规则集 ${list(item.rule_set).join('、')}`)
  if (item.domain_suffix) conditions.push(`域名后缀 ${list(item.domain_suffix).slice(0,2).join('、')}`)
  if (item.ip_cidr) conditions.push(`IP ${list(item.ip_cidr).slice(0,2).join('、')}`)
  if (item.protocol) conditions.push(`协议 ${list(item.protocol).join('、')}`)
  if (item.ip_is_private) conditions.push('私有目标 IP')
  return conditions.join(' · ') || '无条件（匹配全部）'
}
</script>

<template>
  <section class="singbox-module-panel">
    <header class="singbox-module-heading"><div><h2>路由规则</h2><p>按从上到下的顺序匹配。规则集、入站和目标出站均从现有标签中选择。</p></div><NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加规则</NButton></header>
    <NAlert v-if="!ruleSetOptions.length" type="warning" :bordered="false" class="module-alert">还没有规则集。可以先到“规则集”模块一键添加国内、广告或常用服务规则。</NAlert>
    <div v-if="items.length" class="route-rule-list"><article v-for="(item,index) in items" :key="index" class="editor-card route-rule-card"><span class="route-rule-index">{{ index+1 }}</span><div><strong>{{ describe(item) }}</strong><small>{{ item.action || 'route' }}<template v-if="item.outbound"> → {{ item.outbound }}</template></small></div><div class="route-rule-actions"><NButton quaternary circle :disabled="index===0" title="上移" @click="move(index,-1)"><template #icon><ArrowUp :size="14" /></template></NButton><NButton quaternary circle :disabled="index===items.length-1" title="下移" @click="move(index,1)"><template #icon><ArrowDown :size="14" /></template></NButton><NButton quaternary circle title="可视化编辑" @click="openEdit(index)"><template #icon><Pencil :size="14" /></template></NButton><NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(index)"><template #trigger><NButton quaternary circle title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>确定删除此路由规则吗？</NPopconfirm></div></article></div>
    <div v-else class="editor-card empty-state">还没有路由规则，未命中时将使用“基础设置”中的默认出站</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingIndex===null?'添加':'编辑'}路由规则`" class="structured-modal singbox-visual-modal" :bordered="false"><NAlert type="info" :bordered="false">同一条规则填写的多个条件为“同时满足”；每个条件中的多个值为“满足任一”。</NAlert><div class="visual-form singbox-modal-form"><div class="config-field config-field--wide"><div class="field-copy"><label>规则集</label><p>从已经添加的规则集中选择</p></div><NSelect multiple filterable :value="list(draft.rule_set)" :options="ruleSetOptions" placeholder="可选择多个规则集" @update:value="patch('rule_set',$event)" /></div><div class="config-field config-field--wide"><div class="field-copy"><label>指定入站</label><p>只匹配来自所选入站的连接</p></div><NSelect multiple filterable :value="list(draft.inbound)" :options="inboundOptions" placeholder="不限制入站" @update:value="patch('inbound',$event)" /></div><div class="config-field config-field--wide"><div class="field-copy"><label>网络类型</label><p>TCP、UDP 或 ICMP</p></div><NSelect multiple :value="list(draft.network)" :options="options(['tcp','udp','icmp'])" placeholder="不限制网络类型" @update:value="patch('network',$event)" /></div><div class="config-field config-field--wide"><div class="field-copy"><label>协议</label><p>由协议嗅探识别</p></div><NSelect multiple filterable tag :value="list(draft.protocol)" :options="options(['http','tls','quic','dns','ssh','rdp','stun','bittorrent'])" placeholder="不限制协议" @update:value="patch('protocol',$event)" /></div><ConfigField :field="{path:'domain_suffix',label:'域名后缀',type:'tags',placeholder:'example.com'}" :model-value="draft.domain_suffix" @update:model-value="patch('domain_suffix',$event)" /><ConfigField :field="{path:'domain_keyword',label:'域名关键词',type:'tags',placeholder:'google'}" :model-value="draft.domain_keyword" @update:model-value="patch('domain_keyword',$event)" /><ConfigField :field="{path:'ip_cidr',label:'目标 IP/CIDR',type:'tags',placeholder:'1.1.1.0/24'}" :model-value="draft.ip_cidr" @update:model-value="patch('ip_cidr',$event)" /><ConfigField :field="{path:'process_name',label:'进程名称',type:'tags',placeholder:'chrome.exe'}" :model-value="draft.process_name" @update:model-value="patch('process_name',$event)" /><div class="config-field config-field--switch"><div class="field-copy"><label>匹配私有目标 IP</label><p>局域网与保留地址段</p></div><div class="naive-switch-wrap"><NSwitch :value="draft.ip_is_private===true" @update:value="patch('ip_is_private',$event)" /><span>{{ draft.ip_is_private===true?'开启':'关闭' }}</span></div></div><div class="config-field config-field--switch"><div class="field-copy"><label>反向匹配</label><p>对当前条件结果取反</p></div><div class="naive-switch-wrap"><NSwitch :value="draft.invert===true" @update:value="patch('invert',$event)" /><span>{{ draft.invert===true?'开启':'关闭' }}</span></div></div><div class="config-field"><div class="field-copy"><label>执行动作</label><p>路由、拒绝或 DNS 劫持</p></div><NSelect :value="String(draft.action||'route')" :options="options(['route','reject','hijack-dns','sniff','resolve','bypass'])" @update:value="changeAction" /></div><div v-if="draft.action==='route'||!draft.action||draft.action==='bypass'" class="config-field"><div class="field-copy"><label>目标出站</label><p>从已有出站或代理组中选择</p></div><NSelect clearable filterable :value="draft.outbound ? String(draft.outbound) : null" :options="outboundOptions" placeholder="选择目标出站" @update:value="patch('outbound',$event)" /></div><div v-if="draft.action==='reject'" class="config-field"><div class="field-copy"><label>拒绝方式</label><p>default 返回错误，drop 静默丢弃</p></div><NSelect :value="String(draft.method||'default')" :options="options(['default','drop','reply'])" @update:value="patch('method',$event)" /></div></div><template #footer><div class="modal-actions"><NButton @click="dialogOpen=false">取消</NButton><NButton type="primary" @click="save">保存规则</NButton></div></template></NModal>
  </section>
</template>


