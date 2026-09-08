<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { ArrowLeftRight, CheckCircle2, CircleAlert, Download, FileCode2, FilePlus2, Gauge, Globe2, Network, Route, ServerCog, ShieldCheck, Upload } from '@lucide/vue'
import { NBadge, NButton, NModal, useMessage } from 'naive-ui'
import SingBoxBasicsEditor from '@/components/singbox/SingBoxBasicsEditor.vue'
import SingBoxDnsEditor from '@/components/singbox/SingBoxDnsEditor.vue'
import SingBoxInboundsEditor from '@/components/singbox/SingBoxInboundsEditor.vue'
import SingBoxOutboundsEditor from '@/components/singbox/SingBoxOutboundsEditor.vue'
import SingBoxRulesEditor from '@/components/singbox/SingBoxRulesEditor.vue'
import SingBoxRuleSetsEditor from '@/components/singbox/SingBoxRuleSetsEditor.vue'
import { useSingBoxStore } from '@/stores/singbox'

type SectionId = 'basics' | 'inbounds' | 'outbounds' | 'dns' | 'rule-sets' | 'rules' | 'source'

const store = useSingBoxStore()
const message = useMessage()
const SourceEditor = defineAsyncComponent(() => import('@/components/YamlEditor.vue'))
const rawSource = ref('')
const parseError = ref('')
const validationOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const activeSection = ref<SectionId>('basics')

const sections = [
  { id: 'basics' as const, label: '基础设置', icon: Gauge },
  { id: 'inbounds' as const, label: '入站', icon: Network },
  { id: 'outbounds' as const, label: '出站与代理组', icon: ServerCog },
  { id: 'dns' as const, label: 'DNS', icon: Globe2 },
  { id: 'rule-sets' as const, label: '规则集', icon: ShieldCheck },
  { id: 'rules' as const, label: '路由规则', icon: Route },
  { id: 'source' as const, label: '高级源码', icon: FileCode2 },
]

const records = (value: unknown) => Array.isArray(value) ? value.length : 0
const route = computed(() => store.get('route') as Record<string, unknown> | undefined)
const summary = computed(() => [
  { label: '入站', value: records(store.config.inbounds), section: 'inbounds' as const },
  { label: '出站', value: records(store.config.outbounds), section: 'outbounds' as const },
  { label: '规则集', value: records(route.value?.rule_set), section: 'rule-sets' as const },
  { label: '路由规则', value: records(route.value?.rules), section: 'rules' as const },
])
const errorCount = computed(() => store.issues.filter((issue) => issue.level === 'error').length)

function syncSource() { rawSource.value = store.source; parseError.value = '' }
function switchSection(section: SectionId) { activeSection.value = section }
function newConfig() { store.newConfig(); syncSource(); activeSection.value = 'basics'; message.success('已新建 sing-box 配置') }
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.importJson(await file.text(), file.name)
    syncSource()
    activeSection.value = 'basics'
    validationOpen.value = true
    message.success(`已读取 ${file.name}，可直接进行可视化编辑`)
  } catch (cause) {
    parseError.value = cause instanceof Error ? cause.message : 'JSON 解析失败'
    message.error(parseError.value, { duration: 6000 })
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}
function validateConfig() {
  validationOpen.value = true
  if (!store.issues.length) message.success('JSON Schema 与引用校验均已通过')
}
function applyAndValidate() {
  try {
    store.applySource(rawSource.value)
    syncSource()
    validateConfig()
  } catch (cause) {
    parseError.value = cause instanceof Error ? cause.message : 'JSON 解析失败'
  }
}
function exportJson() {
  if (errorCount.value) {
    validationOpen.value = true
    return message.error('发现配置错误，修复后才能导出')
  }
  store.download()
  message.success('sing-box JSON 已导出')
}

watch(activeSection, (value) => { if (value === 'source') syncSource() })
onMounted(() => { store.restoreDraft(); syncSource() })
</script>

<template>
  <div class="singbox-studio">
    <header class="app-header singbox-header">
      <div class="app-logo"><div><ShieldCheck :size="18" /></div><strong>sing-box Flow</strong><span>可视化配置</span></div>
      <div class="header-file"><i :class="{ changed: store.changed }" />{{ store.fileName }}</div>
      <div class="header-actions singbox-actions">
        <RouterLink to="/mihomo/general"><NButton quaternary aria-label="切换到 Mihomo" title="切换到 Mihomo"><template #icon><ArrowLeftRight :size="15" /></template>Mihomo</NButton></RouterLink>
        <NButton quaternary aria-label="新建配置" title="新建配置" @click="newConfig"><template #icon><FilePlus2 :size="15" /></template>新建</NButton>
        <NButton quaternary aria-label="导入 JSON" title="导入 JSON" @click="fileInput?.click()"><template #icon><Upload :size="15" /></template>导入</NButton>
        <NButton quaternary aria-label="导出 JSON" title="导出 JSON" @click="exportJson"><template #icon><Download :size="15" /></template>导出</NButton>
        <NBadge :value="store.issues.length" :show="store.issues.length > 0" :max="99"><NButton type="primary" secondary aria-label="校验配置" title="校验配置" @click="validateConfig"><template #icon><CheckCircle2 :size="15" /></template>校验</NButton></NBadge>
      </div>
      <input ref="fileInput" class="hidden" type="file" accept=".json,.jsonc,application/json" @change="importFile" />
    </header>

    <main class="singbox-main">
      <section class="singbox-intro">
        <div><span class="eyebrow">SING-BOX 1.14</span><h1>可视化配置工作台</h1><p>导入 JSON 或 JSONC 后自动拆分为表单。代理组、规则集和路由引用均通过选择完成，未知高级字段原样保留。</p></div>
        <a href="https://sing-box.sagernet.org/configuration/" target="_blank">查看官方文档</a>
      </section>

      <section class="singbox-summary" aria-label="配置概览">
        <button v-for="item in summary" :key="item.label" type="button" :class="{ active: activeSection === item.section }" @click="switchSection(item.section)"><strong>{{ item.value }}</strong><span>{{ item.label }}</span></button>
        <button type="button" class="validation-state" :class="{ invalid: errorCount }" @click="validateConfig"><ShieldCheck :size="20" /><div><strong>{{ errorCount ? `${errorCount} 个错误` : '结构正常' }}</strong><span>{{ store.issues.length - errorCount }} 个提醒</span></div></button>
      </section>

      <nav class="singbox-section-nav" aria-label="sing-box 配置模块">
        <button v-for="section in sections" :key="section.id" type="button" :class="{ active: activeSection === section.id }" @click="switchSection(section.id)"><component :is="section.icon" :size="16" /><span>{{ section.label }}</span></button>
      </nav>

      <SingBoxBasicsEditor v-if="activeSection === 'basics'" />
      <SingBoxInboundsEditor v-else-if="activeSection === 'inbounds'" />
      <SingBoxOutboundsEditor v-else-if="activeSection === 'outbounds'" />
      <SingBoxDnsEditor v-else-if="activeSection === 'dns'" />
      <SingBoxRuleSetsEditor v-else-if="activeSection === 'rule-sets'" />
      <SingBoxRulesEditor v-else-if="activeSection === 'rules'" />
      <section v-else class="singbox-editor-card">
        <header><div><strong>高级 JSON / JSONC 源码</strong><span>用于尚未覆盖的实验性字段，应用后会重新进入完整校验</span></div><NButton type="primary" @click="applyAndValidate">应用并校验</NButton></header>
        <div class="singbox-source"><SourceEditor v-model="rawSource" language="json" editable /></div>
        <p v-if="parseError" class="raw-error">{{ parseError }}</p>
      </section>
    </main>

    <NModal v-model:show="validationOpen" preset="card" title="sing-box 完整校验" class="validation-modal" :bordered="false">
      <div v-if="!store.issues.length" class="validation-ok"><CheckCircle2 :size="36" /><strong>配置校验通过</strong><span>JSON 语法、官方 Schema、标签引用和代理组嵌套均未发现问题。</span></div>
      <div v-else class="issue-list"><div v-for="(issue,index) in store.issues" :key="index" :class="issue.level"><CircleAlert :size="17" /><span><strong>{{ issue.path }}</strong>{{ issue.message }}</span></div></div>
      <template #footer><div class="validation-footer"><span>{{ errorCount }} 个错误，{{ store.issues.length - errorCount }} 个提醒</span><NButton type="primary" @click="validationOpen = false">完成</NButton></div></template>
    </NModal>
  </div>
</template>
