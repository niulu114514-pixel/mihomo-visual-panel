<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, X } from '@lucide/vue'
import type { ConfigFieldSchema } from '@/schemas/types'

const props = defineProps<{ field: ConfigFieldSchema; modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const tagInput = ref('')
const tags = computed(() => Array.isArray(props.modelValue) ? props.modelValue.map(String) : [])

function inputValue(event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  if (props.field.type === 'number') emit('update:modelValue', target.value === '' ? undefined : Number(target.value))
  else emit('update:modelValue', target.value || undefined)
}

function addTags() {
  const additions = tagInput.value.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean)
  if (!additions.length) return
  emit('update:modelValue', [...new Set([...tags.value, ...additions])])
  tagInput.value = ''
}

function removeTag(index: number) {
  const next = tags.value.filter((_, itemIndex) => itemIndex !== index)
  emit('update:modelValue', next.length ? next : undefined)
}

function tagKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTags() }
}

const checked = computed(() => props.modelValue === true)
watch(() => props.modelValue, () => { if (props.field.type !== 'tags') tagInput.value = '' })
</script>

<template>
  <div class="config-field" :class="{ 'config-field--switch': field.type === 'switch', 'config-field--wide': field.type === 'tags' || field.type === 'textarea' }">
    <div class="field-copy"><label :for="field.path">{{ field.label }}</label><p v-if="field.description">{{ field.description }}</p></div>
    <label v-if="field.type === 'switch'" class="switch-control">
      <input :id="field.path" type="checkbox" :checked="checked" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
      <i /><span>{{ checked ? '开启' : '关闭' }}</span>
    </label>
    <select v-else-if="field.type === 'select'" :id="field.path" class="control" :value="modelValue ?? ''" @change="inputValue">
      <option value="">未设置</option><option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <textarea v-else-if="field.type === 'textarea'" :id="field.path" class="control textarea" :placeholder="field.placeholder" :value="String(modelValue ?? '')" @input="inputValue" />
    <div v-else-if="field.type === 'tags'" class="tag-editor">
      <div v-if="tags.length" class="tags"><span v-for="(tag, index) in tags" :key="`${tag}-${index}`">{{ tag }}<button type="button" @click="removeTag(index)"><X :size="12" /></button></span></div>
      <div class="tag-input"><input v-model="tagInput" class="control" :placeholder="field.placeholder" @keydown="tagKeydown" @blur="addTags" /><button type="button" aria-label="添加" @click="addTags"><Plus :size="15" /></button></div>
    </div>
    <input v-else :id="field.path" class="control" :type="field.type === 'number' ? 'number' : 'text'" :min="field.min" :max="field.max" :placeholder="field.placeholder" :value="modelValue ?? ''" @input="inputValue" />
  </div>
</template>
