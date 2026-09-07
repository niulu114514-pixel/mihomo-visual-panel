<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup, EditorView } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{ modelValue: string; editable?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const host = ref<HTMLElement | null>(null)
let view: EditorView | undefined

function createEditor() {
  view?.destroy()
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        yaml(),
        oneDark,
        EditorView.lineWrapping,
        EditorState.readOnly.of(!props.editable),
        EditorView.editable.of(Boolean(props.editable)),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: 'transparent' },
          '.cm-scroller': { overflow: 'auto', fontFamily: '"Cascadia Code", Consolas, monospace', fontSize: '11px', lineHeight: '1.75' },
          '.cm-gutters': { backgroundColor: 'rgba(15,24,29,.2)', borderRight: '1px solid rgba(255,255,255,.06)', color: '#63757e' },
          '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.025)' },
          '.cm-content': { padding: '14px 0 36px' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && props.editable) emit('update:modelValue', update.state.doc.toString())
        }),
      ],
    }),
  })
}

watch(() => props.editable, createEditor)
watch(() => props.modelValue, (value) => {
  if (!view || value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})
onMounted(createEditor)
onBeforeUnmount(() => view?.destroy())
</script>

<template><div ref="host" class="yaml-editor" /></template>
