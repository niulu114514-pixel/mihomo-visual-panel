export interface MihomoRuleProviderTemplate {
  name: string
  label: string
  description: string
  behavior: 'domain' | 'ipcidr'
  category: 'geosite' | 'geoip'
  code: string
}

export const mihomoRuleProviderTemplates: MihomoRuleProviderTemplate[] = [
  { name: 'private-domain', label: '私有域名', description: '局域网及私有域名', behavior: 'domain', category: 'geosite', code: 'private' },
  { name: 'private-ip', label: '私有 IP', description: '局域网及保留地址', behavior: 'ipcidr', category: 'geoip', code: 'private' },
  { name: 'ads-domain', label: '广告域名', description: '广告与追踪域名', behavior: 'domain', category: 'geosite', code: 'category-ads-all' },
  { name: 'cn-domain', label: '中国域名', description: '中国大陆常用域名', behavior: 'domain', category: 'geosite', code: 'cn' },
  { name: 'cn-ip', label: '中国 IP', description: '中国大陆 IP 地址段', behavior: 'ipcidr', category: 'geoip', code: 'cn' },
  { name: 'global-domain', label: '非中国域名', description: '常用境外域名', behavior: 'domain', category: 'geosite', code: 'geolocation-!cn' },
  { name: 'openai-domain', label: 'OpenAI', description: 'OpenAI 相关域名', behavior: 'domain', category: 'geosite', code: 'openai' },
  { name: 'github-domain', label: 'GitHub', description: 'GitHub 相关域名', behavior: 'domain', category: 'geosite', code: 'github' },
  { name: 'youtube-domain', label: 'YouTube', description: 'YouTube 相关域名', behavior: 'domain', category: 'geosite', code: 'youtube' },
  { name: 'google-domain', label: 'Google', description: 'Google 服务域名', behavior: 'domain', category: 'geosite', code: 'google' },
  { name: 'telegram-domain', label: 'Telegram 域名', description: 'Telegram 服务域名', behavior: 'domain', category: 'geosite', code: 'telegram' },
  { name: 'microsoft-domain', label: 'Microsoft', description: 'Microsoft 服务域名', behavior: 'domain', category: 'geosite', code: 'microsoft' },
  { name: 'apple-domain', label: 'Apple', description: 'Apple 服务域名', behavior: 'domain', category: 'geosite', code: 'apple' },
  { name: 'netflix-domain', label: 'Netflix', description: 'Netflix 流媒体域名', behavior: 'domain', category: 'geosite', code: 'netflix' },
  { name: 'disney-domain', label: 'Disney+', description: 'Disney+ 流媒体域名', behavior: 'domain', category: 'geosite', code: 'disney' },
  { name: 'spotify-domain', label: 'Spotify', description: 'Spotify 音乐服务域名', behavior: 'domain', category: 'geosite', code: 'spotify' },
  { name: 'steam-domain', label: 'Steam', description: 'Steam 游戏平台域名', behavior: 'domain', category: 'geosite', code: 'steam' },
  { name: 'telegram-ip', label: 'Telegram IP', description: 'Telegram IP 地址段', behavior: 'ipcidr', category: 'geoip', code: 'telegram' },
]

export function createMihomoRuleProvider(template: MihomoRuleProviderTemplate) {
  const path = `geo/${template.category}/${template.code}.mrs`
  return {
    type: 'http',
    behavior: template.behavior,
    format: 'mrs',
    url: `https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/${path}`,
    path: `./ruleset/${template.name}.mrs`,
    'path-in-bundle': path,
    interval: 86400,
    proxy: 'DIRECT',
  }
}
