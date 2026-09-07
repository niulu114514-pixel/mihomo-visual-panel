<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, Pencil, Plus, Trash2 } from '@lucide/vue'
import { NButton, NDynamicTags, NInput, NModal, NPopconfirm, useMessage } from 'naive-ui'
import type { ConfigModuleSchema } from '@/schemas/types'
import { useConfigStore } from '@/stores/config'

const props = defineProps<{ module: ConfigModuleSchema }>()
const store = useConfigStore()
const message = useMessage()
const dialogOpen = ref(false)
const editingDomain = ref('')
const domain = ref('')
const values = ref<string[]>([])
const valueDraft = ref('')
const query = ref('')

const hosts = computed<Record<string, unknown>>(() => {
  const value = store.get(props.module.rootKey!)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
})
const entries = computed(() => Object.entries(hosts.value).filter(([key, value]) => `${key} ${JSON.stringify(value)}`.toLowerCase().includes(query.value.toLowerCase())))

function openNew() {
  editingDomain.value = ''
  domain.value = ''
  values.value = []
  valueDraft.value = ''
  dialogOpen.value = true
}

function openEdit(key: string, value: unknown) {
  editingDomain.value = key
  domain.value = key
  values.value = Array.isArray(value) ? value.map(String) : [String(value)]
  valueDraft.value = ''
  dialogOpen.value = true
}

function save() {
  const key = domain.value.trim()
  const nextValues = values.value.map((value) => value.trim()).filter(Boolean)
  if (!key) return message.warning('请填写域名')
  if (!nextValues.length) return message.warning('请至少填写一个目标地址或域名')
  const next = { ...hosts.value }
  if (key !== editingDomain.value && Object.hasOwn(next, key)) return message.error(`域名“${key}”已经存在`)
  if (editingDomain.value) delete next[editingDomain.value]
  next[key] = nextValues.length === 1 ? nextValues[0] : nextValues
  store.setRoot(props.module.rootKey!, next)
  dialogOpen.value = false
  message.success('Hosts 映射已保存')
}

function remove(key: string) {
  const next = { ...hosts.value }
  delete next[key]
  store.setRoot(props.module.rootKey!, next)
}

function submitValue(submit: (value: string) => void) {
  const value = valueDraft.value.trim()
  if (!value) return
  submit(value)
  valueDraft.value = ''
}
</script>

<template>
  <div class="module-content">
    <header class="module-heading module-heading--actions">
      <div><h1>{{ module.label }}</h1><p>{{ module.description }} <a :href="`https://wiki.metacubex.one${module.docsPath}`" target="_blank">查看官方文档 <ExternalLink :size="12" /></a></p></div>
      <NButton type="primary" @click="openNew"><template #icon><Plus :size="15" /></template>添加映射</NButton>
    </header>
    <div class="collection-toolbar"><NInput v-model:value="query" clearable placeholder="搜索域名或地址" class="collection-search" /><span>共 {{ Object.keys(hosts).length }} 项</span></div>
    <section v-if="entries.length" class="editor-card hosts-table">
      <article v-for="[key, value] in entries" :key="key" class="host-row">
        <div class="host-domain"><strong>{{ key }}</strong><span>域名或通配符</span></div>
        <div class="host-values"><span v-for="item in (Array.isArray(value) ? value : [value])" :key="String(item)">{{ item }}</span></div>
        <div class="host-actions">
          <NButton quaternary circle size="small" title="编辑" @click="openEdit(key, value)"><template #icon><Pencil :size="14" /></template></NButton>
          <NPopconfirm positive-text="删除" negative-text="取消" @positive-click="remove(key)"><template #trigger><NButton quaternary circle size="small" title="删除"><template #icon><Trash2 :size="14" /></template></NButton></template>确定删除此 Hosts 映射吗？</NPopconfirm>
        </div>
      </article>
    </section>
    <div v-else class="editor-card empty-state">还没有 Hosts 映射，点击右上角开始添加</div>

    <NModal v-model:show="dialogOpen" preset="card" :title="`${editingDomain ? '编辑' : '添加'} Hosts 映射`" class="hosts-modal" :bordered="false">
      <div class="hosts-form">
        <label><span>域名或通配符</span><NInput v-model:value="domain" placeholder="example.com 或 *.example.com" /></label>
        <label><span>目标地址或域名</span><NDynamicTags v-model:value="values"><template #input="{ submit, deactivate }"><NInput v-model:value="valueDraft" size="small" placeholder="1.1.1.1，回车添加" @blur="deactivate" @keyup.enter="submitValue(submit)" /></template></NDynamicTags><small>一个值输出为字符串，多个值自动输出为数组</small></label>
      </div>
      <template #footer><div class="modal-actions"><NButton @click="dialogOpen = false">取消</NButton><NButton type="primary" @click="save">保存</NButton></div></template>
    </NModal>
  </div>
</template>
