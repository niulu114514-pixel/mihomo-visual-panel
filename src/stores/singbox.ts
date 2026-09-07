import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConfigDocument } from '@/core/config-engine'
import { SingBoxConfigEngine } from '@/adapters/singbox/SingBoxConfigEngine'

const DRAFT_KEY = 'mihomo-flow.sing-box-draft'
const engine = new SingBoxConfigEngine()

export const useSingBoxStore = defineStore('sing-box-config', () => {
  const config = ref<ConfigDocument>(engine.createEmpty())
  const fileName = ref('config.json')
  const changed = ref(false)
  const source = computed(() => engine.stringify(config.value))
  const issues = computed(() => engine.validate(config.value))

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

  return { config, fileName, changed, source, issues, newConfig, applySource, importJson, restoreDraft, download }
})
