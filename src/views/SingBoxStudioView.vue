<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { ArrowLeftRight, CheckCircle2, CircleAlert, Download, FilePlus2, ShieldCheck, Upload } from '@lucide/vue'
import { NBadge, NButton, NModal, useMessage } from 'naive-ui'
import { useSingBoxStore } from '@/stores/singbox'

const store = useSingBoxStore()
const message = useMessage()
const SourceEditor = defineAsyncComponent(() => import('@/components/YamlEditor.vue'))
const rawSource = ref('')
const parseError = ref('')
const validationOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const records = (key: string) => Array.isArray(store.config[key]) ? (store.config[key] as unknown[]).length : 0
const routeRules = computed(() => {
  const route = store.config.route
  return route && typeof route === 'object' && !Array.isArray(route) && Array.isArray((route as Record<string, unknown>).rules) ? ((route as Record<string, unknown>).rules as unknown[]).length : 0
})
const summary = computed(() => [
  { label: '入站', value: records('inbounds') },
  { label: '出站', value: records('outbounds') },
  { label: '路由规则', value: routeRules.value },
  { label: '服务', value: records('services') },
])
const errorCount = computed(() => store.issues.filter((issue) => issue.level === 'error').length)

function syncSource() { rawSource.value = store.source; parseError.value = '' }
function newConfig() { store.newConfig(); syncSource(); message.success('已新建 sing-box 配置') }
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    store.importJson(await file.text(), file.name)
    syncSource()
    validationOpen.value = true
    message.success(`已读取 ${file.name}`)
  } catch (cause) {
    parseError.value = cause instanceof Error ? cause.message : 'JSON 解析失败'
    message.error(parseError.value, { duration: 6000 })
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}
function applyAndValidate() {
  try {
    store.applySource(rawSource.value)
    syncSource()
    validationOpen.value = true
    if (!store.issues.length) message.success('JSON Schema 与引用校验均已通过')
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

onMounted(() => { store.restoreDraft(); syncSource() })
</script>

<template>
  <div class="singbox-studio">
    <header class="app-header singbox-header">
      <div class="app-logo"><div><ShieldCheck :size="18" /></div><strong>sing-box Flow</strong><span>JSON 配置工坊</span></div>
      <div class="header-file"><i :class="{ changed: store.changed }" />{{ store.fileName }}</div>
      <div class="header-actions singbox-actions">
        <RouterLink to="/mihomo/general"><NButton quaternary aria-label="切换到 Mihomo" title="切换到 Mihomo"><template #icon><ArrowLeftRight :size="15" /></template>Mihomo</NButton></RouterLink>
        <NButton quaternary aria-label="新建配置" title="新建配置" @click="newConfig"><template #icon><FilePlus2 :size="15" /></template>新建</NButton>
        <NButton quaternary aria-label="导入 JSON" title="导入 JSON" @click="fileInput?.click()"><template #icon><Upload :size="15" /></template>导入</NButton>
        <NButton quaternary aria-label="导出 JSON" title="导出 JSON" @click="exportJson"><template #icon><Download :size="15" /></template>导出</NButton>
        <NBadge :value="store.issues.length" :show="store.issues.length > 0" :max="99"><NButton type="primary" secondary aria-label="校验配置" title="校验配置" @click="applyAndValidate"><template #icon><CheckCircle2 :size="15" /></template>校验</NButton></NBadge>
      </div>
      <input ref="fileInput" class="hidden" type="file" accept=".json,.jsonc,application/json" @change="importFile" />
    </header>

    <main class="singbox-main">
      <section class="singbox-intro">
        <div><span class="eyebrow">SING-BOX 1.14</span><h1>JSON 配置工作台</h1><p>支持 JSON 与带注释的 JSONC；使用内置官方 Schema 检查字段、协议结构和必填项，并额外检查标签引用。</p></div>
        <a href="https://sing-box.sagernet.org/configuration/schema/" target="_blank">官方 Schema 文档</a>
      </section>

      <section class="singbox-summary" aria-label="配置概览"><article v-for="item in summary" :key="item.label"><strong>{{ item.value }}</strong><span>{{ item.label }}</span></article><article class="validation-state" :class="{ invalid: errorCount }"><ShieldCheck :size="20" /><div><strong>{{ errorCount ? `${errorCount} 个错误` : '结构正常' }}</strong><span>{{ store.issues.length - errorCount }} 个提醒</span></div></article></section>

      <section class="singbox-editor-card">
        <header><div><strong>配置源码</strong><span>输入后点击“应用并校验”</span></div><NButton type="primary" @click="applyAndValidate">应用并校验</NButton></header>
        <div class="singbox-source"><SourceEditor v-model="rawSource" language="json" editable /></div>
        <p v-if="parseError" class="raw-error">{{ parseError }}</p>
      </section>
    </main>

    <NModal v-model:show="validationOpen" preset="card" title="sing-box 完整校验" class="validation-modal" :bordered="false">
      <div v-if="!store.issues.length" class="validation-ok"><CheckCircle2 :size="36" /><strong>配置校验通过</strong><span>JSON 语法、官方 Schema 与标签引用均未发现问题</span></div>
      <div v-else class="issue-list"><div v-for="(issue,index) in store.issues" :key="index" :class="issue.level"><CircleAlert :size="17" /><span><strong>{{ issue.path }}</strong>{{ issue.message }}</span></div></div>
      <template #footer><div class="validation-footer"><span>{{ errorCount }} 个错误，{{ store.issues.length - errorCount }} 个提醒</span><NButton type="primary" @click="validationOpen = false">完成</NButton></div></template>
    </NModal>
  </div>
</template>
