import type { ConfigFieldSchema } from './types'

export interface StructuredModuleSchema {
  collection: 'map' | 'list'
  itemLabel: string
  nameLabel?: string
  defaults: Record<string, unknown>
  fields: ConfigFieldSchema[]
}

const providerType = ['http', 'file', 'inline'].map((value) => ({ label: value, value }))

export const structuredModuleSchemas: Record<string, StructuredModuleSchema> = {
  'proxy-providers': {
    collection: 'map',
    itemLabel: '代理集合',
    nameLabel: '集合名称',
    defaults: { type: 'http', interval: 3600, proxy: 'DIRECT' },
    fields: [
      { path: 'type', label: '来源类型', type: 'select', options: providerType, description: '远程、本地文件或内联节点' },
      { path: 'url', label: '订阅地址', type: 'text', placeholder: 'https://example.com/sub.yaml' },
      { path: 'path', label: '保存路径', type: 'text', placeholder: './proxy_providers/provider.yaml' },
      { path: 'interval', label: '更新间隔（秒）', type: 'number', min: 0, placeholder: '3600' },
      { path: 'proxy', label: '下载代理', type: 'text', placeholder: 'DIRECT' },
      { path: 'size-limit', label: '大小限制（字节）', type: 'number', min: 0, placeholder: '0' },
      { path: 'filter', label: '包含过滤', type: 'text', placeholder: '(?i)港|HK' },
      { path: 'exclude-filter', label: '排除过滤', type: 'text', placeholder: '到期|剩余流量' },
      { path: 'exclude-type', label: '排除协议', type: 'text', placeholder: 'ss|http' },
      { path: 'health-check.enable', label: '健康检查', type: 'switch' },
      { path: 'health-check.url', label: '检查地址', type: 'text', placeholder: 'https://www.gstatic.com/generate_204' },
      { path: 'health-check.interval', label: '检查间隔（秒）', type: 'number', min: 0, placeholder: '300' },
      { path: 'health-check.timeout', label: '检查超时（毫秒）', type: 'number', min: 0, placeholder: '5000' },
      { path: 'health-check.lazy', label: '惰性检查', type: 'switch' },
      { path: 'override.additional-prefix', label: '节点名前缀', type: 'text', placeholder: '机场 A |' },
      { path: 'override.additional-suffix', label: '节点名后缀', type: 'text', placeholder: '| 专线' },
    ],
  },
  'rule-providers': {
    collection: 'map',
    itemLabel: '规则集合',
    nameLabel: '集合名称',
    defaults: { type: 'http', behavior: 'classical', format: 'yaml', interval: 86400, proxy: 'DIRECT' },
    fields: [
      { path: 'type', label: '来源类型', type: 'select', options: providerType },
      { path: 'behavior', label: '规则行为', type: 'select', options: ['domain', 'ipcidr', 'classical'].map((value) => ({ label: value, value })) },
      { path: 'format', label: '文件格式', type: 'select', options: ['yaml', 'text', 'mrs'].map((value) => ({ label: value, value })) },
      { path: 'url', label: '规则地址', type: 'text', placeholder: 'https://example.com/rules.yaml' },
      { path: 'path', label: '保存路径', type: 'text', placeholder: './ruleset/rules.yaml' },
      { path: 'path-in-bundle', label: 'Bundle 路径', type: 'text', placeholder: 'geo/geosite/cn.mrs' },
      { path: 'interval', label: '更新间隔（秒）', type: 'number', min: 0, placeholder: '86400' },
      { path: 'proxy', label: '下载代理', type: 'text', placeholder: 'DIRECT' },
      { path: 'size-limit', label: '大小限制（字节）', type: 'number', min: 0, placeholder: '0' },
      { path: 'payload', label: '内联规则', type: 'tags', placeholder: 'DOMAIN-SUFFIX,example.com' },
    ],
  },
  tunnels: {
    collection: 'list',
    itemLabel: '流量隧道',
    defaults: { network: ['tcp', 'udp'], address: '127.0.0.1:6553', target: '', proxy: 'DIRECT' },
    fields: [
      { path: 'network', label: '网络类型', type: 'tags', placeholder: 'tcp 或 udp', description: '可同时监听 TCP 与 UDP' },
      { path: 'address', label: '本地监听地址', type: 'text', placeholder: '127.0.0.1:6553' },
      { path: 'target', label: '转发目标', type: 'text', placeholder: '8.8.8.8:53' },
      { path: 'proxy', label: '出站代理', type: 'text', placeholder: 'DIRECT' },
    ],
  },
  listeners: {
    collection: 'list',
    itemLabel: '入站监听',
    defaults: { name: '', type: 'mixed', listen: '0.0.0.0', port: 7890 },
    fields: [
      { path: 'name', label: '入站名称', type: 'text', placeholder: 'mixed-in' },
      { path: 'type', label: '监听类型', type: 'select', options: ['mixed', 'http', 'socks', 'redirect', 'tproxy', 'tunnel', 'tun', 'shadowsocks', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic'].map((value) => ({ label: value, value })) },
      { path: 'listen', label: '监听地址', type: 'text', placeholder: '0.0.0.0' },
      { path: 'port', label: '监听端口', type: 'number', min: 1, max: 65535, placeholder: '7890' },
      { path: 'udp', label: '监听 UDP', type: 'switch' },
      { path: 'network', label: '网络类型', type: 'tags', placeholder: 'tcp 或 udp' },
      { path: 'target', label: '隧道目标', type: 'text', placeholder: 'target.com:443' },
      { path: 'routing-mark', label: 'Routing Mark', type: 'number', min: 0, placeholder: '0' },
      { path: 'rule', label: '子规则', type: 'text', placeholder: 'sub-rule-1' },
      { path: 'proxy', label: '固定出站', type: 'text', placeholder: '代理组名称' },
      { path: 'certificate', label: 'TLS 证书', type: 'text', placeholder: './server.crt' },
      { path: 'private-key', label: 'TLS 私钥', type: 'text', placeholder: './server.key' },
    ],
  },
}
