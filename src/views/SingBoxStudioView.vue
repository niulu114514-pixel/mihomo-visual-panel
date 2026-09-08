<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref } from 'vue'
import { CheckCircle2, CircleAlert, Code2, Download, FileCode2, FilePlus2, Gauge, Globe2, Menu, Network, Route, ServerCog, ShieldCheck, Upload, X, Eye, FileText } from '@lucide/vue'
import { NBadge, NButton, NModal, useMessage } from 'naive-ui'
import SingBoxBasicsEditor from '@/components/singbox/SingBoxBasicsEditor.vue'
import SingBoxDnsEditor from '@/components/singbox/SingBoxDnsEditor.vue'
import SingBoxInboundsEditor from '@/components/singbox/SingBoxInboundsEditor.vue'
import SingBoxOutboundsEditor from '@/components/singbox/SingBoxOutboundsEditor.vue'
import SingBoxRulesEditor from '@/components/singbox/SingBoxRulesEditor.vue'
import SingBoxRuleSetsEditor from '@/components/singbox/SingBoxRuleSetsEditor.vue'
import VisualValueEditor from '@/components/VisualValueEditor.vue'
import { useSingBoxStore } from '@/stores/singbox'
import { sourceLineForPath } from '@/utils/source-location'
import type { ConfigDocument, ValidationIssue } from '@/core/config-engine'

type SectionId = 'basics' | 'inbounds' | 'outbounds' | 'dns' | 'rule-sets' | 'rules' | 'complete'

const store = useSingBoxStore()
const message = useMessage()
const SourceEditor = defineAsyncComponent(() => import('@/components/YamlEditor.vue'))
const rawSource = ref('')
const parseError = ref('')
const validationOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const activeSection = ref<SectionId>('basics')
const navOpen = ref(false)
const previewOpen = ref(!window.matchMedia('(max-width: 850px)').matches)
const rawEdit = ref(false)
const previewFocusLine = ref(1)

const sections = [
  { id: 'basics' as const, label: '基础设置', icon: Gauge, path: 'log' },
  { id: 'inbounds' as const, label: '入站', icon: Network, path: 'inbounds' },
  { id: 'outbounds' as const, label: '出站与代理组', icon: ServerCog, path: 'outbounds' },
  { id: 'dns' as const, label: 'DNS', icon: Globe2, path: 'dns' },
  { id: 'rule-sets' as const, label: '规则集', icon: ShieldCheck, path: 'route.rule_set' },
  { id: 'rules' as const, label: '路由规则', icon: Route, path: 'route.rules' },
  { id: 'complete' as const, label: '完整配置树', icon: FileCode2, path: '$' },
]

const errorCount = computed(() => store.issues.filter((issue) => issue.level === 'error').length)
const sourceLineCount = computed(() => store.source.split('\n').length)
const previewMarkers = computed(() => store.issues.map((issue) => ({ line: sourceLineForPath(store.source, issue.path, 'json'), level: issue.level })))
const completeConfig = computed({
  get: () => store.config as ConfigDocument,
  set: (value: ConfigDocument) => store.replaceConfig(value),
})

function syncSource() { rawSource.value = store.source; parseError.value = '' }
function focusPreview(path: string) {
  previewOpen.value = true
  previewFocusLine.value = sourceLineForPath(store.source, path, 'json')
}
function switchSection(section: SectionId) {
  activeSection.value = section
  navOpen.value = false
  focusPreview(sections.find((item) => item.id === section)?.path ?? '$')
}
function sectionForPath(path: string): SectionId {
  if (path.startsWith('inbounds')) return 'inbounds'
  if (path.startsWith('outbounds')) return 'outbounds'
  if (path.startsWith('dns')) return 'dns'
  if (path.startsWith('route.rule_set')) return 'rule-sets'
  if (path.startsWith('route.rules')) return 'rules'
  if (path.startsWith('log') || path.startsWith('route.final') || path.startsWith('route.auto_')) return 'basics'
  return 'complete'
}
function newConfig() { store.newConfig(); syncSource(); switchSection('basics'); message.success('已新建 sing-box 配置') }
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.importJson(await file.text(), file.name)
    syncSource()
    switchSection('basics')
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
function toggleRaw() {
  rawEdit.value = !rawEdit.value
  syncSource()
}
function applyAndValidate() {
  try {
    store.applySource(rawSource.value)
    rawEdit.value = false
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
async function jumpToIssue(issue: ValidationIssue) {
  validationOpen.value = false
  switchSection(sectionForPath(issue.path))
  await nextTick()
  focusPreview(issue.path)
}

onMounted(() => { store.restoreDraft(); syncSource(); focusPreview('log') })
</script>

<template>
  <div class="builder singbox-builder" :class="{ 'preview-closed': !previewOpen, 'nav-visible': navOpen }">
    <header class="app-header singbox-header">
      <NButton quaternary circle class="mobile-icon" aria-label="打开配置导航" @click="navOpen=true"><template #icon><Menu :size="19" /></template></NButton>
      <div class="app-logo"><div><ShieldCheck :size="18" /></div><strong>sing-box Flow</strong><span>配置工坊</span></div>
      <div class="header-file"><i :class="{ changed: store.changed }" />{{ store.fileName }}</div>
      <div class="header-actions singbox-actions">
        <NButton quaternary @click="newConfig"><template #icon><FilePlus2 :size="15" /></template>新建</NButton>
        <NButton quaternary @click="fileInput?.click()"><template #icon><Upload :size="15" /></template>导入</NButton>
        <NButton quaternary @click="exportJson"><template #icon><Download :size="15" /></template>导出</NButton>
        <NBadge :value="store.issues.length" :show="store.issues.length > 0" :max="99"><NButton quaternary @click="validateConfig"><template #icon><CheckCircle2 :size="15" /></template>校验</NButton></NBadge>
        <NButton class="preview-button" :type="previewOpen ? 'primary' : 'default'" secondary @click="previewOpen=!previewOpen"><template #icon><Eye :size="15" /></template>预览</NButton>
      </div>
      <input ref="fileInput" class="hidden" type="file" accept=".json,.jsonc,application/json" @change="importFile" />
    </header>

    <div class="nav-scrim" @click="navOpen=false" />
    <aside class="module-nav">
      <div class="mobile-nav-head"><strong>配置模块</strong><NButton quaternary circle @click="navOpen=false"><template #icon><X :size="18" /></template></NButton></div>
      <nav><button v-for="section in sections" :key="section.id" type="button" :class="{ active: activeSection===section.id }" @click="switchSection(section.id)"><component :is="section.icon" :size="17" /><span>{{ section.label }}</span></button></nav>
      <div class="nav-footer"><RouterLink to="/mihomo/general"><div><Code2 :size="17" /><span><strong>切换到 Mihomo</strong><small>YAML · 完整可视化</small></span><CheckCircle2 :size="15" /></div></RouterLink><p>官方 Schema 本地校验</p></div>
    </aside>

    <main class="workspace singbox-workspace">
      <SingBoxBasicsEditor v-if="activeSection === 'basics'" />
      <SingBoxInboundsEditor v-else-if="activeSection === 'inbounds'" />
      <SingBoxOutboundsEditor v-else-if="activeSection === 'outbounds'" />
      <SingBoxDnsEditor v-else-if="activeSection === 'dns'" />
      <SingBoxRuleSetsEditor v-else-if="activeSection === 'rule-sets'" />
      <SingBoxRulesEditor v-else-if="activeSection === 'rules'" />
      <section v-else class="module-content complete-config-panel">
        <header class="module-heading"><div><h1>完整配置树</h1><p>递归编辑任意 sing-box 字段、对象和数组，官方 Schema 会即时校验类型与协议结构。</p></div></header>
        <div class="editor-card complete-editor-card"><VisualValueEditor v-model="completeConfig" root /></div>
      </section>
    </main>

    <aside v-if="previewOpen" class="yaml-preview">
      <header><div><Code2 :size="15" /><strong>JSON 预览</strong><span>{{ sourceLineCount }} 行</span></div><div><NButton size="tiny" ghost @click="toggleRaw"><template #icon><FileText :size="13" /></template>{{ rawEdit ? '取消编辑' : '源码编辑' }}</NButton></div></header>
      <SourceEditor :model-value="rawEdit ? rawSource : store.source" language="json" :editable="rawEdit" :focus-line="previewFocusLine" :markers="previewMarkers" @update:model-value="rawSource=$event" />
      <p v-if="parseError" class="raw-error">{{ parseError }}</p>
      <footer v-if="rawEdit"><NButton block type="primary" @click="applyAndValidate">应用并校验</NButton></footer>
    </aside>

    <NModal v-model:show="validationOpen" preset="card" title="sing-box 完整校验" class="validation-modal" :bordered="false">
      <div v-if="!store.issues.length" class="validation-ok"><CheckCircle2 :size="36" /><strong>配置校验通过</strong><span>JSON 语法、官方 Schema、标签引用和代理组嵌套均未发现问题。</span></div>
      <div v-else class="issue-list"><button v-for="(issue,index) in store.issues" :key="index" type="button" :class="issue.level" @click="jumpToIssue(issue)"><CircleAlert :size="17" /><span><strong>{{ issue.path }}</strong>{{ issue.message }}</span><small>定位到第 {{ sourceLineForPath(store.source, issue.path, 'json') }} 行</small></button></div>
      <template #footer><div class="validation-footer"><span>{{ errorCount }} 个错误，{{ store.issues.length - errorCount }} 个提醒</span><NButton type="primary" @click="validationOpen=false">完成</NButton></div></template>
    </NModal>
  </div>
</template>
