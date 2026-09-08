<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/vue'
import { NButton, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'

type ValueKind = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'

const props = withDefaults(defineProps<{
  modelValue: unknown
  depth?: number
  root?: boolean
}>(), { depth: 0, root: false })
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const typeOptions: Array<{ label: string; value: ValueKind }> = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '开关', value: 'boolean' },
  { label: '对象', value: 'object' },
  { label: '数组', value: 'array' },
  { label: '空值', value: 'null' },
]

function kindOf(value: unknown): ValueKind {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

function defaultValue(kind: ValueKind): unknown {
  if (kind === 'object') return {}
  if (kind === 'array') return []
  if (kind === 'number') return 0
  if (kind === 'boolean') return false
  if (kind === 'null') return null
  return ''
}

const kind = computed(() => kindOf(props.modelValue))
const objectEntries = computed(() => kind.value === 'object' ? Object.entries(props.modelValue as Record<string, unknown>) : [])
const arrayItems = computed(() => kind.value === 'array' ? props.modelValue as unknown[] : [])

function setKind(value: ValueKind) {
  if (value !== kind.value) emit('update:modelValue', defaultValue(value))
}

function updateObject(key: string, value: unknown) {
  emit('update:modelValue', Object.fromEntries(objectEntries.value.map(([entryKey, entryValue]) => [entryKey, entryKey === key ? value : entryValue])))
}

function renameObjectKey(oldKey: string, requested: string) {
  const nextKey = requested.trim()
  if (!nextKey || nextKey === oldKey) return
  const entries = objectEntries.value
  if (entries.some(([key]) => key === nextKey)) return
  emit('update:modelValue', Object.fromEntries(entries.map(([key, value]) => [key === oldKey ? nextKey : key, value])))
}

function removeObjectKey(key: string) {
  emit('update:modelValue', Object.fromEntries(objectEntries.value.filter(([entryKey]) => entryKey !== key)))
}

function addObjectKey() {
  const used = new Set(objectEntries.value.map(([key]) => key))
  let index = 1
  let key = 'new-field'
  while (used.has(key)) key = `new-field-${++index}`
  emit('update:modelValue', Object.fromEntries([...objectEntries.value, [key, '']]))
}

function updateArray(index: number, value: unknown) {
  emit('update:modelValue', arrayItems.value.map((item, itemIndex) => itemIndex === index ? value : item))
}

function removeArray(index: number) {
  emit('update:modelValue', arrayItems.value.filter((_, itemIndex) => itemIndex !== index))
}

function moveArray(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= arrayItems.value.length) return
  const next = [...arrayItems.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  emit('update:modelValue', next)
}

function addArrayItem() {
  emit('update:modelValue', [...arrayItems.value, ''])
}
</script>

<template>
  <div class="visual-value" :class="[`visual-value--${kind}`, { 'visual-value--root': root }]">
    <NSelect v-if="!root" size="small" class="visual-value__type" :value="kind" :options="typeOptions" @update:value="setKind" />

    <div v-if="kind === 'object'" class="visual-object">
      <div v-for="([key,value],index) in objectEntries" :key="`${key}-${index}`" class="visual-object__entry">
        <div class="visual-value__entry-head">
          <NInput size="small" :value="key" aria-label="字段名称" @change="renameObjectKey(key,$event)" />
          <NButton quaternary circle size="small" title="删除字段" @click="removeObjectKey(key)"><template #icon><Trash2 :size="14" /></template></NButton>
        </div>
        <VisualValueEditor :model-value="value" :depth="depth + 1" @update:model-value="updateObject(key,$event)" />
      </div>
      <NButton dashed size="small" class="visual-value__add" @click="addObjectKey"><template #icon><Plus :size="14" /></template>添加字段</NButton>
    </div>

    <div v-else-if="kind === 'array'" class="visual-array">
      <div v-for="(value,index) in arrayItems" :key="index" class="visual-array__entry">
        <div class="visual-value__entry-head visual-value__entry-head--array">
          <span>#{{ index + 1 }}</span>
          <div>
            <NButton quaternary circle size="tiny" :disabled="index === 0" title="上移" @click="moveArray(index,-1)"><template #icon><ArrowUp :size="13" /></template></NButton>
            <NButton quaternary circle size="tiny" :disabled="index === arrayItems.length - 1" title="下移" @click="moveArray(index,1)"><template #icon><ArrowDown :size="13" /></template></NButton>
            <NButton quaternary circle size="tiny" title="删除项目" @click="removeArray(index)"><template #icon><Trash2 :size="13" /></template></NButton>
          </div>
        </div>
        <VisualValueEditor :model-value="value" :depth="depth + 1" @update:model-value="updateArray(index,$event)" />
      </div>
      <NButton dashed size="small" class="visual-value__add" @click="addArrayItem"><template #icon><Plus :size="14" /></template>添加数组项</NButton>
    </div>

    <NSwitch v-else-if="kind === 'boolean'" :value="Boolean(modelValue)" @update:value="emit('update:modelValue',$event)" />
    <NInputNumber v-else-if="kind === 'number'" :value="Number(modelValue)" @update:value="emit('update:modelValue',$event ?? 0)" />
    <div v-else-if="kind === 'null'" class="visual-value__null">null</div>
    <NInput v-else type="textarea" :value="String(modelValue ?? '')" :autosize="{ minRows: 1, maxRows: 8 }" @update:value="emit('update:modelValue',$event)" />
  </div>
</template>
