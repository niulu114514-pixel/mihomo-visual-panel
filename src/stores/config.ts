import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConfigDocument } from '@/core/config-engine'
import { MihomoConfigEngine } from '@/adapters/mihomo/MihomoConfigEngine'

const DRAFT_KEY = 'mihomo-flow.config-draft'
const engine = new MihomoConfigEngine()

function readPath(root: ConfigDocument, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, root)
}

function cleanEmptyContainers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanEmptyContainers)
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, cleanEmptyContainers(item)] as const)
    .filter(([, item]) => item !== undefined && item !== '' && (!Array.isArray(item) || item.length > 0) && (!(item && typeof item === 'object' && !Array.isArray(item)) || Object.keys(item as object).length > 0))
  return Object.fromEntries(entries)
}

export const useConfigStore = defineStore('config', () => {
  const config = ref<ConfigDocument>(engine.createEmpty())
  const fileName = ref('config.yaml')
  const changed = ref(false)
  const importWarnings = ref<string[]>([])
  const yaml = computed(() => engine.stringify(cleanEmptyContainers(config.value) as ConfigDocument))
  const issues = computed(() => engine.validate(config.value))

  function touch() {
    changed.value = true
    localStorage.setItem(DRAFT_KEY, yaml.value)
  }

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
    touch()
  }

  function setRoot(key: string, value: unknown) { set(key, value) }

  function replaceConfig(value: ConfigDocument) {
    config.value = JSON.parse(JSON.stringify(value)) as ConfigDocument
    touch()
  }

  function newConfig() {
    config.value = engine.createEmpty()
    fileName.value = 'config.yaml'
    importWarnings.value = []
    changed.value = false
    localStorage.removeItem(DRAFT_KEY)
  }

  function importYaml(source: string, name = 'config.yaml') {
    const result = engine.parse(source)
    config.value = result.config
    fileName.value = name.replace(/\.(yml|yaml)$/i, '') + '.yaml'
    importWarnings.value = result.warnings
    changed.value = false
    localStorage.setItem(DRAFT_KEY, source)
  }

  function applyRaw(source: string) {
    const result = engine.parse(source)
    config.value = result.config
    importWarnings.value = result.warnings
    touch()
  }

  function restoreDraft() {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (!draft) return false
    try { importYaml(draft, 'draft.yaml'); changed.value = true; return true } catch { return false }
  }

  function download() {
    const blob = new Blob([yaml.value], { type: 'application/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName.value
    anchor.click()
    URL.revokeObjectURL(url)
    changed.value = false
  }

  return { config, fileName, changed, yaml, issues, importWarnings, get, set, setRoot, replaceConfig, newConfig, importYaml, applyRaw, restoreDraft, download }
})
