<script setup lang="ts">
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NLoadingBarProvider,
  NMessageProvider,
  type GlobalThemeOverrides,
  zhCN,
  dateZhCN,
} from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#2563eb',
    primaryColorHover: '#3b73ed',
    primaryColorPressed: '#1d4ed8',
    primaryColorSuppl: '#2563eb',
    borderRadius: '7px',
    fontSize: '12px',
  },
  Button: { heightMedium: '34px', fontSizeMedium: '11px' },
  Input: { heightMedium: '36px', fontSizeMedium: '11px' },
  Select: { peers: { InternalSelection: { heightMedium: '36px', fontSizeMedium: '11px' } } },
  Collapse: { titleFontSize: '12px', titleFontWeight: '600' },
}
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider placement="top-right">
          <RouterView />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
