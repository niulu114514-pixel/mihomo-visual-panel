<script setup lang="ts">
import { computed } from 'vue'
import { NDynamicTags, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import type { ConfigFieldSchema } from '@/schemas/types'

const props = defineProps<{ field: ConfigFieldSchema; modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const stringValue = computed(() => props.modelValue == null ? '' : String(props.modelValue))
const numberValue = computed(() => typeof props.modelValue === 'number' ? props.modelValue : null)
const booleanValue = computed(() => props.modelValue === true)
const tagValue = computed(() => Array.isArray(props.modelValue) ? props.modelValue.map(String) : [])

function setString(value: string) { emit('update:modelValue', value || undefined) }
function setNumber(value: number | null) { emit('update:modelValue', value ?? undefined) }
function setSelect(value: string | null) { emit('update:modelValue', value || undefined) }
function setTags(value: string[]) { emit('update:modelValue', value.length ? value : undefined) }
</script>

<template>
  <div class="config-field" :class="{ 'config-field--switch': field.type === 'switch', 'config-field--wide': field.type === 'tags' || field.type === 'textarea' }">
    <div class="field-copy"><label>{{ field.label }}</label><p v-if="field.description">{{ field.description }}</p></div>
    <div v-if="field.type === 'switch'" class="naive-switch-wrap"><NSwitch :value="booleanValue" size="small" @update:value="emit('update:modelValue', $event)" /><span>{{ booleanValue ? '开启' : '关闭' }}</span></div>
    <NSelect v-else-if="field.type === 'select'" clearable :value="stringValue || null" :options="field.options" placeholder="未设置" @update:value="setSelect" />
    <NInputNumber v-else-if="field.type === 'number'" clearable :value="numberValue" :min="field.min" :max="field.max" :placeholder="field.placeholder" @update:value="setNumber" />
    <NDynamicTags v-else-if="field.type === 'tags'" :value="tagValue" @update:value="setTags"><template #input="{ submit, deactivate }"><NInput size="small" :placeholder="field.placeholder" @blur="deactivate" @keyup.enter="submit($event)" /></template></NDynamicTags>
    <NInput v-else-if="field.type === 'textarea'" type="textarea" :value="stringValue" :placeholder="field.placeholder" :autosize="{ minRows: 3, maxRows: 10 }" @update:value="setString" />
    <NInput v-else :value="stringValue" :placeholder="field.placeholder" @update:value="setString" />
  </div>
</template>
