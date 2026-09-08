<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Activity, CheckCircle2, ChevronDown, CircleAlert, CloudUpload, Code2, Copy, Download, Eye,
  FilePlus2, FileText, Globe2, Grid2X2, Hexagon, Layers3, LockKeyhole, Menu, Monitor,
  Route, Search, Settings2, Upload, UserRound, UsersRound, X, Zap,
} from '@lucide/vue'
import { NBadge, NButton, NModal, useDialog, useMessage } from 'naive-ui'
import FormModule from '@/components/FormModule.vue'
import CollectionEditor from '@/components/CollectionEditor.vue'
import ProxyGroupEditor from '@/components/ProxyGroupEditor.vue'
import HostsEditor from '@/components/HostsEditor.vue'
import RulesEditor from '@/components/RulesEditor.vue'
import RawModuleEditor from '@/components/RawModuleEditor.vue'
import StructuredCollectionEditor from '@/components/StructuredCollectionEditor.vue'
import { mihomoModules } from '@/schemas/mihomo'
import { useConfigStore } from '@/stores/config'
import { sourceLineForPath } from '@/utils/source-location'
import type { ValidationIssue } from '@/core/config-engine'

const route = useRoute()
const router = useRouter()
const store = useConfigStore()
const YamlEditor = defineAsyncComponent(() => import('@/components/YamlEditor.vue'))
const dialog = useDialog()
const message = useMessage()
const previewOpen = ref(!window.matchMedia('(max-width: 850px)').matches)
const navOpen = ref(false)
const validationOpen = ref(false)
const rawEdit = ref(false)
const rawSource = ref('')
const rawError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const previewFocusLine = ref(1)

const activeId = computed(() => String(route.params.moduleId || 'general'))
const activeModule = computed(() => mihomoModules.find((item) => item.id === activeId.value) ?? mihomoModules[0]!)
const icons: Record<string, typeof Settings2> = {
  settings: Settings2, globe: Globe2, users: UsersRound, cloud: CloudUpload, file: FileText,
  route: Route, activity: Activity, lock: LockKeyhole, monitor: Monitor, user: UserRound,
  layers: Layers3, search: Search, hexagon: Hexagon, zap: Zap, grid: Grid2X2,
}
const errorCount = computed(() => store.issues.filter((item) => item.level === 'error').length)
const yamlLineCount = computed(() => store.yaml.split('\n').length)
const previewMarkers = computed(() => store.issues.map((issue) => ({ line: sourceLineForPath(store.yaml, issue.path, 'yaml'), level: issue.level })))

function modulePath(module = activeModule.value) {
  if (module.rootKey) return module.rootKey
  return module.sections?.flatMap((section) => section.fields).find((field) => store.get(field.path) !== undefined)?.path
    ?? module.sections?.[0]?.fields[0]?.path
    ?? '$'
}

function moduleForPath(path: string) {
  const root = path.split('.')[0] || ''
  return mihomoModules.find((module) => module.rootKey === root || module.sections?.some((section) => section.fields.some((field) => field.path === root || field.path.startsWith(`${root}.`))))
    ?? mihomoModules[0]!
}

function focusPreview(path: string) {
  previewOpen.value = true
  previewFocusLine.value = sourceLineForPath(store.yaml, path, 'yaml')
}

async function jumpToIssue(issue: ValidationIssue) {
  validationOpen.value = false
  const module = moduleForPath(issue.path)
  await router.push(`/mihomo/${module.id}`)
  await nextTick()
  focusPreview(issue.path)
}

function chooseModule(id: string) {
  navOpen.value = false
  void router.push(`/mihomo/${id}`)
}

function resetConfig() {
  store.newConfig()
  void router.push('/mihomo/general')
  message.success('已新建配置')
}

function newFile() {
  if (!store.changed) return resetConfig()
  dialog.warning({
    title: '新建配置',
    content: '当前修改尚未导出，确定放弃修改并新建配置吗？',
    positiveText: '确定新建',
    negativeText: '取消',
    onPositiveClick: resetConfig,
  })
}

async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.importYaml(await file.text(), file.name)
    await router.push('/mihomo/general')
    const count = (key: string) => Array.isArray(store.get(key)) ? (store.get(key) as unknown[]).length : 0
    message.success(`已读取 ${file.name}：${count('proxies')} 个节点、${count('proxy-groups')} 个代理组、${count('rules')} 条规则`, { duration: 5000 })
    if (errorCount.value) validationOpen.value = true
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '导入失败', { duration: 5000 })
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function copyYaml() {
  await navigator.clipboard.writeText(store.yaml)
  message.success('YAML 已复制')
}

function exportYaml() {
  if (errorCount.value) {
    validationOpen.value = true
    return message.error('发现配置错误，修复后才能导出')
  }
  store.download()
  message.success('配置已导出')
}

function toggleRaw() {
  rawEdit.value = !rawEdit.value
  rawSource.value = store.yaml
  rawError.value = ''
}

function applyRaw() {
  try {
    store.applyRaw(rawSource.value)
    rawError.value = ''
    rawEdit.value = false
    message.success('源码修改已应用')
  } catch (cause) {
    rawError.value = cause instanceof Error ? cause.message : 'YAML 解析失败'
  }
}

watch(() => route.params.moduleId, async () => { navOpen.value = false; await nextTick(); focusPreview(modulePath()) })
onMounted(async () => { store.restoreDraft(); await nextTick(); focusPreview(modulePath()) })
</script>

<template>
  <div class="builder" :class="{ 'preview-closed': !previewOpen, 'nav-visible': navOpen }">
    <header class="app-header">
      <NButton quaternary circle class="mobile-icon" aria-label="打开配置导航" title="打开配置导航" @click="navOpen = true"><template #icon><Menu :size="19" /></template></NButton>
      <div class="app-logo"><div><Activity :size="18" /></div><strong>Mihomo Flow</strong><span>配置工坊</span></div>
      <div class="header-file"><i :class="{ changed: store.changed }" />{{ store.fileName }}</div>
      <div class="header-actions">
        <NButton quaternary aria-label="新建配置" title="新建配置" @click="newFile"><template #icon><FilePlus2 :size="15" /></template>新建</NButton>
        <NButton quaternary aria-label="导入配置" title="导入配置" @click="fileInput?.click()"><template #icon><Upload :size="15" /></template>导入</NButton>
        <NButton quaternary aria-label="导出配置" title="导出配置" @click="exportYaml"><template #icon><Download :size="15" /></template>导出<ChevronDown :size="12" /></NButton>
        <span class="header-divider" />
        <NBadge :value="store.issues.length" :show="store.issues.length > 0" :max="99">
          <NButton quaternary aria-label="验证配置" title="验证配置" @click="validationOpen = true"><template #icon><CheckCircle2 :size="15" /></template>验证</NButton>
        </NBadge>
        <NButton class="preview-button" :type="previewOpen ? 'primary' : 'default'" secondary aria-label="切换 YAML 预览" title="切换 YAML 预览" @click="previewOpen = !previewOpen"><template #icon><Eye :size="15" /></template>预览</NButton>
      </div>
      <input ref="fileInput" class="hidden" type="file" accept=".yaml,.yml,text/yaml" @change="importFile" />
    </header>

    <div class="nav-scrim" @click="navOpen = false" />
    <aside class="module-nav">
      <div class="mobile-nav-head"><strong>配置模块</strong><NButton quaternary circle aria-label="关闭配置导航" @click="navOpen = false"><template #icon><X :size="18" /></template></NButton></div>
      <nav>
        <button v-for="item in mihomoModules" :key="item.id" :class="{ active: item.id === activeId }" @click="chooseModule(item.id)"><component :is="icons[item.icon]" :size="17" /><span>{{ item.label }}</span></button>
      </nav>
      <div class="nav-footer">
        <RouterLink to="/sing-box/"><div><Code2 :size="17" /><span><strong>切换到 sing-box</strong><small>JSON/JSONC · 官方 Schema 校验</small></span><CheckCircle2 :size="15" /></div></RouterLink>
        <p>基于本地官方文档构建</p>
      </div>
    </aside>

    <main class="workspace">
      <FormModule v-if="activeModule.kind === 'form'" :key="activeModule.id" :module="activeModule" />
      <CollectionEditor v-else-if="activeModule.kind === 'proxies'" :key="activeModule.id" :module="activeModule" />
      <ProxyGroupEditor v-else-if="activeModule.kind === 'groups'" :key="activeModule.id" :module="activeModule" />
      <StructuredCollectionEditor v-else-if="activeModule.kind === 'providers' || activeModule.kind === 'raw-list'" :key="activeModule.id" :module="activeModule" />
      <HostsEditor v-else-if="activeModule.kind === 'record'" :key="activeModule.id" :module="activeModule" />
      <RulesEditor v-else-if="activeModule.kind === 'rules'" :key="activeModule.id" :module="activeModule" />
      <RawModuleEditor v-else :key="activeModule.id" :module="activeModule" />
    </main>

    <aside v-if="previewOpen" class="yaml-preview">
      <header>
        <div><Code2 :size="15" /><strong>YAML 预览</strong><span>{{ yamlLineCount }} 行</span></div>
        <div>
          <NButton size="tiny" ghost @click="toggleRaw"><template #icon><FileText :size="13" /></template>{{ rawEdit ? '取消编辑' : '源码编辑' }}</NButton>
          <NButton size="tiny" ghost @click="copyYaml"><template #icon><Copy :size="13" /></template>复制</NButton>
          <NButton size="tiny" ghost circle class="preview-close" aria-label="关闭预览" @click="previewOpen = false"><template #icon><X :size="14" /></template></NButton>
        </div>
      </header>
      <YamlEditor :model-value="rawEdit ? rawSource : store.yaml" :editable="rawEdit" :focus-line="previewFocusLine" :markers="previewMarkers" @update:model-value="rawSource = $event" />
      <div v-if="rawError" class="raw-error">{{ rawError }}</div>
      <footer v-if="rawEdit"><NButton type="primary" block @click="applyRaw">应用 YAML</NButton></footer>
    </aside>

    <NModal v-model:show="validationOpen" preset="card" title="配置验证" class="validation-modal" :bordered="false">
      <div v-if="!store.issues.length" class="validation-ok"><CheckCircle2 :size="36" /><strong>Mihomo 配置校验通过</strong><span>YAML 语法、字段类型、端口和策略引用均未发现问题</span></div>
      <div v-else class="issue-list"><button v-for="(issue,index) in store.issues" :key="index" type="button" :class="issue.level" @click="jumpToIssue(issue)"><CircleAlert :size="17" /><span><strong>{{ issue.path }}</strong>{{ issue.message }}</span><small>定位到第 {{ sourceLineForPath(store.yaml, issue.path, 'yaml') }} 行</small></button></div>
      <template #footer><div class="validation-footer"><span>{{ errorCount }} 个错误，{{ store.issues.length - errorCount }} 个提醒</span><NButton type="primary" @click="validationOpen = false">完成</NButton></div></template>
    </NModal>
  </div>
</template>
