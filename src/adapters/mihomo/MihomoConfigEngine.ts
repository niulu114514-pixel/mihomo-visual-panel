import { parseDocument, stringify } from 'yaml'
import type { ConfigDocument, ConfigEngine, ImportResult, ValidationIssue } from '@/core/config-engine'

const PORT_KEYS = ['port', 'socks-port', 'redir-port', 'tproxy-port', 'mixed-port']

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

export class MihomoConfigEngine implements ConfigEngine {
  readonly id = 'mihomo' as const
  readonly label = 'Mihomo'

  createEmpty(): ConfigDocument {
    return {
      'mixed-port': 7890,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      ipv6: false,
    }
  }

  parse(source: string): ImportResult {
    const document = parseDocument(source.replace(/^\uFEFF/, ''), { prettyErrors: true, uniqueKeys: false, merge: true })
    if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join('\n'))
    const value = document.toJS() as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('配置根节点必须是 YAML 对象')
    return {
      config: value as ConfigDocument,
      warnings: document.warnings.map((warning) => warning.message),
    }
  }

  stringify(config: ConfigDocument) {
    return stringify(config, { lineWidth: 0, indent: 2, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' })
  }

  validate(config: ConfigDocument): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    for (const key of PORT_KEYS) {
      const value = config[key]
      if (value !== undefined && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 65535)) {
        issues.push({ level: 'error', path: key, message: '端口必须是 1–65535 之间的整数' })
      }
    }

    const proxies = asRecords(config.proxies)
    const groups = asRecords(config['proxy-groups'])
    const proxyNames = proxies.map((item) => String(item.name || '')).filter(Boolean)
    const groupNames = groups.map((item) => String(item.name || '')).filter(Boolean)
    const duplicates = [...proxyNames, ...groupNames].filter((name, index, list) => list.indexOf(name) !== index)
    for (const name of new Set(duplicates)) issues.push({ level: 'error', path: 'proxies', message: `代理或代理组名称重复：${name}` })
    proxies.forEach((proxy, index) => {
      if (!proxy.name) issues.push({ level: 'error', path: `proxies.${index}.name`, message: '代理节点缺少名称' })
      if (!proxy.type) issues.push({ level: 'error', path: `proxies.${index}.type`, message: '代理节点缺少协议类型' })
      if (proxy.port !== undefined && (!Number.isInteger(proxy.port) || Number(proxy.port) < 1 || Number(proxy.port) > 65535)) issues.push({ level: 'error', path: `proxies.${index}.port`, message: '节点端口无效' })
    })
    groups.forEach((group, index) => {
      if (!group.name) issues.push({ level: 'error', path: `proxy-groups.${index}.name`, message: '代理组缺少名称' })
      if (!group.type) issues.push({ level: 'error', path: `proxy-groups.${index}.type`, message: '代理组缺少类型' })
      if (!Array.isArray(group.proxies) && !Array.isArray(group.use)) issues.push({ level: 'warning', path: `proxy-groups.${index}`, message: `代理组 ${String(group.name || index)} 没有 proxies 或 use` })
    })
    if (!Array.isArray(config.rules) || config.rules.length === 0) issues.push({ level: 'warning', path: 'rules', message: '当前没有路由规则' })
    const cors = (config['external-controller-cors'] as Record<string, unknown> | undefined)?.['allow-origins']
    if (Array.isArray(cors) && cors.includes('*')) issues.push({ level: 'warning', path: 'external-controller-cors.allow-origins', message: '生产环境不建议允许所有跨域来源' })
    return issues
  }
}
