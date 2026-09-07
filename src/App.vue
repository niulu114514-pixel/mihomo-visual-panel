<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  Activity, CheckCircle2, ChevronDown, CircleAlert, CloudUpload, Code2, Copy, Download, Eye,
  FilePlus2, FileText, Globe2, Grid2X2, Hexagon, Layers3, LockKeyhole, Menu, Monitor,
  Route, Search, Settings2, Upload, UserRound, UsersRound, X, Zap,
} from '@lucide/vue'
import FormModule from '@/components/FormModule.vue'
import CollectionEditor from '@/components/CollectionEditor.vue'
import RulesEditor from '@/components/RulesEditor.vue'
import RawModuleEditor from '@/components/RawModuleEditor.vue'
import { mihomoModules } from '@/schemas/mihomo'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()
const activeId = ref('general')
const previewOpen = ref(true)
const navOpen = ref(false)
const validationOpen = ref(false)
const rawEdit = ref(false)
const rawSource = ref('')
const rawError = ref('')
const copied = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const activeModule = computed(() => mihomoModules.find((item) => item.id === activeId.value) ?? mihomoModules[0]!)
const icons: Record<string, typeof Settings2> = {
  settings: Settings2, globe: Globe2, users: UsersRound, cloud: CloudUpload, file: FileText,
  route: Route, activity: Activity, lock: LockKeyhole, monitor: Monitor, user: UserRound,
  layers: Layers3, search: Search, hexagon: Hexagon, zap: Zap, grid: Grid2X2,
}
const errorCount = computed(() => store.issues.filter((item) => item.level === 'error').length)
const yamlLines = computed(() => store.yaml.split('\n'))

function chooseModule(id: string) { activeId.value = id; navOpen.value = false }
function newFile() {
  if (store.changed && !window.confirm('当前修改尚未导出，确定新建配置吗？')) return
  store.newConfig(); activeId.value = 'general'
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { store.importYaml(await file.text(), file.name); activeId.value = 'general' }
  catch (cause) { window.alert(cause instanceof Error ? cause.message : '导入失败') }
  finally { if (fileInput.value) fileInput.value.value = '' }
}
async function copyYaml() {
  await navigator.clipboard.writeText(store.yaml); copied.value = true
  window.setTimeout(() => { copied.value = false }, 1500)
}
function toggleRaw() {
  rawEdit.value = !rawEdit.value
  rawSource.value = store.yaml
  rawError.value = ''
}
function applyRaw() {
  try { store.applyRaw(rawSource.value); rawError.value = ''; rawEdit.value = false }
  catch (cause) { rawError.value = cause instanceof Error ? cause.message : 'YAML 解析失败' }
}
onMounted(async () => { store.restoreDraft(); await nextTick() })
</script>

<template>
  <div class="builder" :class="{ 'preview-closed': !previewOpen, 'nav-visible': navOpen }">
    <header class="app-header">
      <button class="mobile-icon" @click="navOpen = true"><Menu :size="19" /></button>
      <div class="app-logo"><div><Activity :size="18" /></div><strong>Mihomo Flow</strong><span>配置工坊</span></div>
      <div class="header-file"><i :class="{ changed: store.changed }" />{{ store.fileName }}</div>
      <div class="header-actions">
        <button @click="newFile"><FilePlus2 :size="15" />新建</button>
        <button @click="fileInput?.click()"><Upload :size="15" />导入</button>
        <button @click="store.download"><Download :size="15" />导出<ChevronDown :size="12" /></button>
        <span class="header-divider" />
        <button @click="validationOpen = true"><CheckCircle2 :size="15" />验证<i v-if="store.issues.length" class="issue-dot">{{ store.issues.length }}</i></button>
        <button class="preview-button" :class="{ active: previewOpen }" @click="previewOpen = !previewOpen"><Eye :size="15" />预览</button>
      </div>
      <input ref="fileInput" class="hidden" type="file" accept=".yaml,.yml,text/yaml" @change="importFile" />
    </header>

    <div class="nav-scrim" @click="navOpen = false" />
    <aside class="module-nav">
      <div class="mobile-nav-head"><strong>配置模块</strong><button @click="navOpen = false"><X :size="18" /></button></div>
      <nav><button v-for="item in mihomoModules" :key="item.id" :class="{ active: item.id === activeId }" @click="chooseModule(item.id)"><component :is="icons[item.icon]" :size="17" /><span>{{ item.label }}</span></button></nav>
      <div class="nav-footer"><div><Code2 :size="17" /><span><strong>Mihomo</strong><small>配置规范</small></span><CheckCircle2 :size="15" /></div><p>基于本地官方文档构建</p></div>
    </aside>

    <main class="workspace">
      <FormModule v-if="activeModule.kind === 'form'" :key="activeModule.id" :module="activeModule" />
      <CollectionEditor v-else-if="activeModule.kind === 'proxies' || activeModule.kind === 'groups'" :key="activeModule.id" :module="activeModule" />
      <RulesEditor v-else-if="activeModule.kind === 'rules'" :key="activeModule.id" :module="activeModule" />
      <RawModuleEditor v-else :key="activeModule.id" :module="activeModule" />
    </main>

    <aside v-if="previewOpen" class="yaml-preview">
      <header><div><Code2 :size="15" /><strong>YAML 预览</strong><span>{{ yamlLines.length }} 行</span></div><div><button @click="toggleRaw"><FileText :size="13" />{{ rawEdit ? '取消编辑' : '源码编辑' }}</button><button @click="copyYaml"><Copy :size="13" />{{ copied ? '已复制' : '复制' }}</button><button class="preview-close" @click="previewOpen = false"><X :size="14" /></button></div></header>
      <template v-if="rawEdit"><textarea v-model="rawSource" class="raw-editor" spellcheck="false" /><div v-if="rawError" class="raw-error">{{ rawError }}</div><footer><button class="apply-raw" @click="applyRaw">应用 YAML</button></footer></template>
      <div v-else class="code-scroller"><div class="line-numbers"><span v-for="(_, index) in yamlLines" :key="index">{{ index + 1 }}</span></div><pre><code>{{ store.yaml }}</code></pre></div>
    </aside>

    <div v-if="validationOpen" class="modal-backdrop" @click.self="validationOpen = false">
      <section class="validation-modal"><header><div><span>VALIDATION</span><h2>配置验证</h2></div><button @click="validationOpen = false"><X :size="18" /></button></header><div v-if="!store.issues.length" class="validation-ok"><CheckCircle2 :size="36" /><strong>配置结构正常</strong><span>未发现明显的字段或引用问题</span></div><div v-else class="issue-list"><div v-for="(issue,index) in store.issues" :key="index" :class="issue.level"><CircleAlert :size="17" /><span><strong>{{ issue.path }}</strong>{{ issue.message }}</span></div></div><footer><span>{{ errorCount }} 个错误，{{ store.issues.length - errorCount }} 个提醒</span><button class="primary-button" @click="validationOpen = false">完成</button></footer></section>
    </div>
  </div>
</template>
