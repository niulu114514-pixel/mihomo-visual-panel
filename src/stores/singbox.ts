import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConfigDocument } from '@/core/config-engine'
import { SingBoxConfigEngine } from '@/adapters/singbox/SingBoxConfigEngine'

const DRAFT_KEY = 'mihomo-flow.sing-box-draft'
const engine = new SingBoxConfigEngine()

function readPath(root: ConfigDocument, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, root)
}

export const useSingBoxStore = defineStore('sing-box-config', () => {
  const config = ref<ConfigDocument>(engine.createEmpty())
  const fileName = ref('config.json')
  const changed = ref(false)
  const source = computed(() => engine.stringify(config.value))
  const issues = computed(() => engine.validate(config.value))

  function get(path: string) { return readPath(config.value, path) }

  function set(path: string, value: unknown) {
    const keys = path.split('.')
    const next = JSON.parse(JSON.stringify(config.value)) as ConfigDocument
    let cursor: Record<string, unknown> = next
    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        if (value === undefined || value === '') delete cursor[key]
        else cursor[key] = value
      } else {
        if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {}
        cursor = cursor[key] as Record<string, unknown>
      }
    })
    config.value = next
    saveDraft()
  }

  function setRoot(key: string, value: unknown) { set(key, value) }

  function replaceConfig(value: ConfigDocument) {
    config.value = JSON.parse(JSON.stringify(value)) as ConfigDocument
    saveDraft()
  }

  function saveDraft() {
    changed.value = true
    localStorage.setItem(DRAFT_KEY, source.value)
  }

  function newConfig() {
    config.value = engine.createEmpty()
    fileName.value = 'config.json'
    changed.value = false
    localStorage.removeItem(DRAFT_KEY)
  }

  function applySource(value: string, name?: string) {
    const result = engine.parse(value)
    config.value = result.config
    if (name) fileName.value = name.replace(/\.jsonc?$/i, '') + '.json'
    saveDraft()
  }

  function importJson(value: string, name: string) {
    const result = engine.parse(value)
    config.value = result.config
    fileName.value = name.replace(/\.jsonc?$/i, '') + '.json'
    changed.value = false
    localStorage.setItem(DRAFT_KEY, source.value)
  }

  function restoreDraft() {
    const value = localStorage.getItem(DRAFT_KEY)
    if (!value) return false
    try { applySource(value); return true } catch { return false }
  }

  function download() {
    const blob = new Blob([source.value], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName.value
    anchor.click()
    URL.revokeObjectURL(url)
    changed.value = false
  }

  return { config, fileName, changed, source, issues, get, set, setRoot, replaceConfig, newConfig, applySource, importJson, restoreDraft, download }
})
