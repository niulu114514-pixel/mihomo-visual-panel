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
    primaryColor: '#315f77',
    primaryColorHover: '#254e65',
    primaryColorPressed: '#1d4055',
    primaryColorSuppl: '#315f77',
    borderRadius: '6px',
    fontSize: '12px',
    boxShadow1: '0 1px 2px rgba(31, 45, 54, 0.05)',
    boxShadow2: '0 12px 34px rgba(31, 45, 54, 0.13)',
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
