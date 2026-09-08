<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup, EditorView } from 'codemirror'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import { yaml } from '@codemirror/lang-yaml'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'

export interface SourceMarker { line: number; level: 'error' | 'warning' }

const props = withDefaults(defineProps<{ modelValue: string; editable?: boolean; language?: 'yaml' | 'json'; focusLine?: number; markers?: SourceMarker[] }>(), { language: 'yaml', focusLine: 1, markers: () => [] })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const host = ref<HTMLElement | null>(null)
let view: EditorView | undefined
const setMarkers = StateEffect.define<SourceMarker[]>()
const markerField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setMarkers)) continue
      const ranges = effect.value
        .filter((marker) => marker.line >= 1 && marker.line <= transaction.state.doc.lines)
        .map((marker) => Decoration.line({ class: `cm-issue-line cm-issue-line--${marker.level}` }).range(transaction.state.doc.line(marker.line).from))
      value = Decoration.set(ranges, true)
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

function applyMarkers() {
  if (view) view.dispatch({ effects: setMarkers.of(props.markers) })
}

function revealLine(line = props.focusLine) {
  if (!view) return
  const safeLine = Math.max(1, Math.min(line || 1, view.state.doc.lines))
  const position = view.state.doc.line(safeLine).from
  view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'center' }) })
  view.focus()
}

function createEditor() {
  view?.destroy()
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        props.language === 'json' ? json() : yaml(),
        oneDark,
        EditorView.lineWrapping,
        EditorState.readOnly.of(!props.editable),
        EditorView.editable.of(Boolean(props.editable)),
        markerField,
        EditorView.theme({
          '&': { height: '100%', backgroundColor: 'transparent' },
          '.cm-scroller': { overflow: 'auto', fontFamily: '"Cascadia Code", Consolas, monospace', fontSize: '11px', lineHeight: '1.75' },
          '.cm-gutters': { backgroundColor: 'rgba(15,24,29,.2)', borderRight: '1px solid rgba(255,255,255,.06)', color: '#63757e' },
          '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.025)' },
          '.cm-content': { padding: '14px 0 36px' },
          '.cm-issue-line--error': { backgroundColor: 'rgba(218,72,72,.16)', boxShadow: 'inset 3px 0 #d65757' },
          '.cm-issue-line--warning': { backgroundColor: 'rgba(214,151,39,.14)', boxShadow: 'inset 3px 0 #d39a38' },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && props.editable) emit('update:modelValue', update.state.doc.toString())
        }),
      ],
    }),
  })
  applyMarkers()
  if (props.focusLine > 1) requestAnimationFrame(() => revealLine())
}

watch(() => [props.editable, props.language], createEditor)
watch(() => props.modelValue, (value) => {
  if (!view || value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
  applyMarkers()
})
watch(() => props.focusLine, (line) => revealLine(line))
watch(() => props.markers, applyMarkers, { deep: true })
onMounted(createEditor)
onBeforeUnmount(() => view?.destroy())
defineExpose({ revealLine })
</script>

<template><div ref="host" class="yaml-editor" /></template>
