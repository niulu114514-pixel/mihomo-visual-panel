import { parseDocument, stringify } from 'yaml'
import type { ConfigDocument, ConfigEngine, ImportResult, ValidationIssue } from '@/core/config-engine'

const PORT_KEYS = ['port', 'socks-port', 'redir-port', 'tproxy-port', 'mixed-port']
const BOOLEAN_KEYS = ['allow-lan', 'ipv6', 'unified-delay', 'tcp-concurrent', 'geodata-mode', 'geo-auto-update']
const GROUP_TYPES = new Set(['select', 'url-test', 'fallback', 'load-balance', 'relay'])
const BUILTIN_TARGETS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'GLOBAL'])
const NETWORK_PROXY_TYPES = new Set(['ss', 'ssr', 'vmess', 'vless', 'trojan', 'hysteria', 'hysteria2', 'tuic', 'socks5', 'http', 'snell', 'ssh', 'anytls', 'mieru', 'wireguard'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function isValidPort(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 65535
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function duplicateNames(values: string[]) {
  return [...new Set(values.filter((value, index) => value && values.indexOf(value) !== index))]
}

function checkRegex(value: unknown) {
  if (typeof value !== 'string' || !value) return true
  try { new RegExp(value); return true } catch { return false }
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
    const document = parseDocument(source.replace(/^\uFEFF/, ''), { prettyErrors: true, uniqueKeys: true, merge: true })
    if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join('\n'))
    const value = document.toJS() as unknown
    if (!isRecord(value)) throw new Error('配置根节点必须是 YAML 对象')
    return { config: value, warnings: document.warnings.map((warning) => warning.message) }
  }

  stringify(config: ConfigDocument) {
    return stringify(config, { lineWidth: 0, indent: 2, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' })
  }

  validate(config: ConfigDocument): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const add = (level: ValidationIssue['level'], path: string, message: string) => issues.push({ level, path, message })

    for (const key of PORT_KEYS) {
      const value = config[key]
      if (value !== undefined && !isValidPort(value)) add('error', key, '端口必须是 1–65535 之间的整数')
    }
    const usedPorts = PORT_KEYS.map((key) => [key, config[key]] as const).filter(([, value]) => value !== undefined && isValidPort(value))
    for (const [key, port] of usedPorts) {
      const earlier = usedPorts.find(([otherKey, otherPort]) => otherKey !== key && otherPort === port)
      if (earlier && PORT_KEYS.indexOf(earlier[0]) < PORT_KEYS.indexOf(key)) add('error', key, `监听端口 ${port} 与 ${earlier[0]} 重复`)
    }
    for (const key of BOOLEAN_KEYS) if (config[key] !== undefined && typeof config[key] !== 'boolean') add('error', key, '该字段必须是 true 或 false')
    if (config.mode !== undefined && !['rule', 'global', 'direct'].includes(String(config.mode))) add('error', 'mode', '运行模式只能是 rule、global 或 direct')
    if (config['log-level'] !== undefined && !['silent', 'error', 'warning', 'info', 'debug'].includes(String(config['log-level']))) add('error', 'log-level', '日志等级无效')
    if (config.authentication !== undefined && !Array.isArray(config.authentication)) add('error', 'authentication', '认证账户必须是数组')

    const collectionTypes: Array<[string, 'array' | 'object']> = [
      ['proxies', 'array'], ['proxy-groups', 'array'], ['rules', 'array'], ['listeners', 'array'], ['tunnels', 'array'],
      ['proxy-providers', 'object'], ['rule-providers', 'object'], ['hosts', 'object'], ['dns', 'object'], ['tun', 'object'], ['sniffer', 'object'],
    ]
    for (const [key, expected] of collectionTypes) {
      const value = config[key]
      if (value === undefined) continue
      if (expected === 'array' ? !Array.isArray(value) : !isRecord(value)) add('error', key, `该配置必须是${expected === 'array' ? '数组' : '对象'}`)
    }

    const proxies = asRecords(config.proxies)
    const groups = asRecords(config['proxy-groups'])
    const proxyProviders = isRecord(config['proxy-providers']) ? config['proxy-providers'] : {}
    const ruleProviders = isRecord(config['rule-providers']) ? config['rule-providers'] : {}
    const proxyNames = proxies.map((item) => String(item.name || '')).filter(Boolean)
    const groupNames = groups.map((item) => String(item.name || '')).filter(Boolean)
    const allTargets = new Set([...proxyNames, ...groupNames, ...BUILTIN_TARGETS])

    for (const name of duplicateNames([...proxyNames, ...groupNames])) add('error', 'proxies', `代理节点或代理组名称重复：${name}`)
    for (const name of duplicateNames(Object.keys(proxyProviders))) add('error', 'proxy-providers', `代理集合名称重复：${name}`)
    for (const name of duplicateNames(Object.keys(ruleProviders))) add('error', 'rule-providers', `规则集合名称重复：${name}`)

    proxies.forEach((proxy, index) => {
      const path = `proxies.${index}`
      const type = String(proxy.type || '')
      if (!proxy.name || typeof proxy.name !== 'string') add('error', `${path}.name`, '代理节点缺少有效名称')
      if (!type) add('error', `${path}.type`, '代理节点缺少协议类型')
      if (NETWORK_PROXY_TYPES.has(type)) {
        if (!proxy.server || typeof proxy.server !== 'string') add('error', `${path}.server`, `${type} 节点缺少服务器地址`)
        if (!isValidPort(proxy.port)) add('error', `${path}.port`, `${type} 节点端口无效`)
      } else if (proxy.port !== undefined && !isValidPort(proxy.port)) add('error', `${path}.port`, '节点端口无效')
      if (proxy['dialer-proxy'] && !allTargets.has(String(proxy['dialer-proxy']))) add('error', `${path}.dialer-proxy`, `引用了不存在的代理：${String(proxy['dialer-proxy'])}`)
    })

    groups.forEach((group, index) => {
      const path = `proxy-groups.${index}`
      const name = String(group.name || '')
      const type = String(group.type || '')
      if (!name) add('error', `${path}.name`, '代理组缺少名称')
      if (!type) add('error', `${path}.type`, '代理组缺少类型')
      else if (!GROUP_TYPES.has(type)) add('error', `${path}.type`, `不支持的代理组类型：${type}`)
      const members = textList(group.proxies)
      const providers = textList(group.use)
      const includesAll = group['include-all'] === true || group['include-all-proxies'] === true || group['include-all-providers'] === true
      if (!members.length && !providers.length && !includesAll) add('warning', path, `代理组 ${name || index + 1} 没有成员、代理集合或全量导入设置`)
      if (group.proxies !== undefined && (!Array.isArray(group.proxies) || members.length !== group.proxies.length)) add('error', `${path}.proxies`, '组内成员必须是字符串数组')
      if (group.use !== undefined && (!Array.isArray(group.use) || providers.length !== group.use.length)) add('error', `${path}.use`, '代理集合引用必须是字符串数组')
      for (const member of members) {
        if (member === name) add('error', `${path}.proxies`, '代理组不能直接引用自身')
        else if (!allTargets.has(member)) add('error', `${path}.proxies`, `引用了不存在的节点或代理组：${member}`)
      }
      for (const provider of providers) if (!Object.hasOwn(proxyProviders, provider)) add('error', `${path}.use`, `引用了不存在的代理集合：${provider}`)
      if (['url-test', 'fallback', 'load-balance'].includes(type) && (!group.url || typeof group.url !== 'string')) add('error', `${path}.url`, `${type} 代理组必须设置健康检查地址`)
      for (const numberKey of ['interval', 'timeout', 'tolerance', 'max-failed-times']) if (group[numberKey] !== undefined && (!Number.isInteger(group[numberKey]) || Number(group[numberKey]) < 0)) add('error', `${path}.${numberKey}`, '必须是非负整数')
      if (type === 'load-balance' && group.strategy !== undefined && !['round-robin', 'consistent-hashing'].includes(String(group.strategy))) add('error', `${path}.strategy`, '负载均衡策略只能是 round-robin 或 consistent-hashing')
      for (const regexKey of ['filter', 'exclude-filter']) if (!checkRegex(group[regexKey])) add('error', `${path}.${regexKey}`, '正则表达式无法解析')
      if (group['default-selected'] && !members.includes(String(group['default-selected']))) add('warning', `${path}.default-selected`, '默认节点不在当前 proxies 成员中')
    })

    Object.entries(proxyProviders).forEach(([name, value]) => {
      const path = `proxy-providers.${name}`
      if (!isRecord(value)) return add('error', path, '代理集合配置必须是对象')
      const type = String(value.type || '')
      if (!['http', 'file', 'inline'].includes(type)) add('error', `${path}.type`, '来源类型只能是 http、file 或 inline')
      if (type === 'http' && (!value.url || typeof value.url !== 'string')) add('error', `${path}.url`, '远程代理集合必须设置订阅地址')
      if (type === 'file' && (!value.path || typeof value.path !== 'string')) add('error', `${path}.path`, '本地代理集合必须设置文件路径')
      if (type === 'inline' && !Array.isArray(value.payload)) add('error', `${path}.payload`, '内联代理集合必须提供 payload 数组')
      if (value.interval !== undefined && (!Number.isInteger(value.interval) || Number(value.interval) < 0)) add('error', `${path}.interval`, '更新间隔必须是非负整数')
      if (value.proxy && !allTargets.has(String(value.proxy))) add('error', `${path}.proxy`, `下载代理不存在：${String(value.proxy)}`)
      for (const regexKey of ['filter', 'exclude-filter']) if (!checkRegex(value[regexKey])) add('error', `${path}.${regexKey}`, '正则表达式无法解析')
    })

    Object.entries(ruleProviders).forEach(([name, value]) => {
      const path = `rule-providers.${name}`
      if (!isRecord(value)) return add('error', path, '规则集合配置必须是对象')
      const type = String(value.type || '')
      if (!['http', 'file', 'inline'].includes(type)) add('error', `${path}.type`, '来源类型只能是 http、file 或 inline')
      if (value.behavior !== undefined && !['domain', 'ipcidr', 'classical'].includes(String(value.behavior))) add('error', `${path}.behavior`, '规则行为只能是 domain、ipcidr 或 classical')
      if (value.format !== undefined && !['yaml', 'text', 'mrs'].includes(String(value.format))) add('error', `${path}.format`, '规则文件格式只能是 yaml、text 或 mrs')
      if (type === 'http' && (!value.url || typeof value.url !== 'string')) add('error', `${path}.url`, '远程规则集合必须设置地址')
      if (type === 'file' && (!value.path || typeof value.path !== 'string')) add('error', `${path}.path`, '本地规则集合必须设置路径')
      if (type === 'inline' && !Array.isArray(value.payload)) add('error', `${path}.payload`, '内联规则集合必须提供 payload 数组')
    })

    const rules = Array.isArray(config.rules) ? config.rules : []
    rules.forEach((rule, index) => {
      const path = `rules.${index}`
      if (typeof rule !== 'string' || !rule.trim()) return add('error', path, '路由规则必须是非空字符串')
      const parts = rule.split(',').map((part) => part.trim())
      const type = parts[0]?.toUpperCase() ?? ''
      if (!type) return add('error', path, '路由规则缺少类型')
      if (type === 'RULE-SET') {
        if (!parts[1] || !Object.hasOwn(ruleProviders, parts[1])) add('error', path, `引用了不存在的规则集合：${parts[1] || '空'}`)
        if (parts.length < 3) return add('error', path, 'RULE-SET 规则缺少目标策略')
      }
      const last = parts.at(-1)
      const target = last === 'no-resolve' ? parts.at(-2) : last
      if (!target || (type === 'MATCH' && parts.length < 2)) add('error', path, '路由规则缺少目标策略')
      else if (!allTargets.has(target)) add('error', path, `目标策略不存在：${target}`)
    })
    if (!rules.length && config.mode === 'rule') add('warning', 'rules', '规则模式下没有路由规则')

    const dns = isRecord(config.dns) ? config.dns : undefined
    if (dns) {
      for (const key of ['enable', 'ipv6', 'respect-rules']) if (dns[key] !== undefined && typeof dns[key] !== 'boolean') add('error', `dns.${key}`, '该字段必须是 true 或 false')
      if (dns['enhanced-mode'] !== undefined && !['fake-ip', 'redir-host'].includes(String(dns['enhanced-mode']))) add('error', 'dns.enhanced-mode', '增强模式只能是 fake-ip 或 redir-host')
      for (const key of ['default-nameserver', 'nameserver', 'proxy-server-nameserver', 'direct-nameserver', 'fallback', 'fake-ip-filter']) if (dns[key] !== undefined && !Array.isArray(dns[key])) add('error', `dns.${key}`, '该字段必须是数组')
    }
    const tun = isRecord(config.tun) ? config.tun : undefined
    if (tun) {
      if (tun.enable !== undefined && typeof tun.enable !== 'boolean') add('error', 'tun.enable', '该字段必须是 true 或 false')
      if (tun.stack !== undefined && !['mixed', 'system', 'gvisor'].includes(String(tun.stack))) add('error', 'tun.stack', 'TUN 网络栈只能是 mixed、system 或 gvisor')
      if (tun.mtu !== undefined && (!Number.isInteger(tun.mtu) || Number(tun.mtu) < 576 || Number(tun.mtu) > 9000)) add('error', 'tun.mtu', 'MTU 必须是 576–9000 之间的整数')
    }
    const cors = isRecord(config['external-controller-cors']) ? config['external-controller-cors']['allow-origins'] : undefined
    if (Array.isArray(cors) && cors.includes('*')) add('warning', 'external-controller-cors.allow-origins', '生产环境不建议允许所有跨域来源')
    return issues
  }
}
