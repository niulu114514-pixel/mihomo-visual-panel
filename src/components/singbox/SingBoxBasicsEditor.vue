<script setup lang="ts">
import { computed } from 'vue'
import { NInput, NSelect, NSwitch } from 'naive-ui'
import { useSingBoxStore } from '@/stores/singbox'
import { records } from './helpers'

const store = useSingBoxStore()
const outboundOptions = computed(() => records(store.config.outbounds).map((item) => String(item.tag || '')).filter(Boolean).map((value) => ({ label: value, value })))
const logLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'panic'].map((value) => ({ label: value, value }))
</script>

<template>
  <section class="singbox-module-panel">
    <header class="singbox-module-heading"><div><h2>基础设置</h2><p>日志、默认出站和路由环境。选择项会自动读取当前配置中的出站标签。</p></div></header>
    <div class="editor-card singbox-form-card visual-form">
      <div class="config-field"><div class="field-copy"><label>日志等级</label><p>一般使用 info，排错时临时改为 debug</p></div><NSelect :value="String(store.get('log.level') || 'info')" :options="logLevels" @update:value="store.set('log.level', $event)" /></div>
      <div class="config-field config-field--switch"><div class="field-copy"><label>日志时间</label><p>在日志中显示时间戳</p></div><div class="naive-switch-wrap"><NSwitch :value="store.get('log.timestamp') === true" @update:value="store.set('log.timestamp', $event)" /><span>{{ store.get('log.timestamp') === true ? '开启' : '关闭' }}</span></div></div>
      <div class="config-field"><div class="field-copy"><label>默认出站</label><p>没有命中路由规则时使用</p></div><NSelect clearable filterable :value="store.get('route.final') ? String(store.get('route.final')) : null" :options="outboundOptions" placeholder="选择已有出站" @update:value="store.set('route.final', $event)" /></div>
      <div class="config-field config-field--switch"><div class="field-copy"><label>自动检测网卡</label><p>防止 TUN 场景出现路由环路</p></div><div class="naive-switch-wrap"><NSwitch :value="store.get('route.auto_detect_interface') === true" @update:value="store.set('route.auto_detect_interface', $event)" /><span>{{ store.get('route.auto_detect_interface') === true ? '开启' : '关闭' }}</span></div></div>
      <div class="config-field"><div class="field-copy"><label>默认网络接口</label><p>设置后不要同时开启自动检测网卡</p></div><NInput :value="String(store.get('route.default_interface') || '')" placeholder="例如 WLAN 或 eth0" @update:value="store.set('route.default_interface', $event)" /></div>
      <div class="config-field config-field--switch"><div class="field-copy"><label>缓存文件</label><p>保存规则集缓存与 Clash API 状态</p></div><div class="naive-switch-wrap"><NSwitch :value="store.get('experimental.cache_file.enabled') === true" @update:value="store.set('experimental.cache_file.enabled', $event)" /><span>{{ store.get('experimental.cache_file.enabled') === true ? '开启' : '关闭' }}</span></div></div>
    </div>
  </section>
</template>


