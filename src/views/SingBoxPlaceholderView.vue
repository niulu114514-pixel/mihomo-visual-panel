<script setup lang="ts">
import { ArrowLeft, Boxes } from '@lucide/vue'
import { NButton, NResult } from 'naive-ui'
</script>

<template>
  <main class="placeholder-view">
    <NResult status="info" title="sing-box 配置工作台" description="路由与配置引擎接口已经预留，下一阶段会在这里接入 sing-box JSON/JSONC。">
      <template #icon><Boxes :size="52" /></template>
      <template #footer><RouterLink to="/mihomo/general"><NButton type="primary"><template #icon><ArrowLeft /></template>返回 Mihomo</NButton></RouterLink></template>
    </NResult>
  </main>
</template>

<style scoped>
.placeholder-view { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f8fc; }
</style>
