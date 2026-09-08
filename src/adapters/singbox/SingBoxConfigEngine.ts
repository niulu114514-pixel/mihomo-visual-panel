import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser'
import schema from './sing-box.schema.json'
import type { ConfigDocument, ConfigEngine, ImportResult, ValidationIssue } from '@/core/config-engine'

const validator = new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(schema)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseErrorMessage(source: string, error: ParseError) {
  const before = source.slice(0, error.offset)
  const line = before.split('\n').length
  const column = error.offset - before.lastIndexOf('\n')
  return `JSON 第 ${line} 行第 ${column} 列：${printParseErrorCode(error.error)}`
}

function schemaIssue(error: ErrorObject): ValidationIssue {
  const detail = error.params as Record<string, unknown>
  const suffix = error.keyword === 'required' ? `.${String(detail.missingProperty ?? '')}` : ''
  const path = `${error.instancePath.replaceAll('/', '.')}${suffix}`.replace(/^\./, '') || '$'
  const messages: Record<string, string> = {
    required: `缺少必填字段 ${String(detail.missingProperty ?? '')}`,
    additionalProperties: `存在不受支持的字段 ${String(detail.additionalProperty ?? '')}`,
    type: `字段类型应为 ${String(detail.type ?? '')}`,
    enum: `字段值不在允许范围内`,
    minimum: `数值不能小于 ${String(detail.limit ?? '')}`,
    maximum: `数值不能大于 ${String(detail.limit ?? '')}`,
    minItems: `数组至少需要 ${String(detail.limit ?? '')} 项`,
    pattern: '字段格式不符合要求',
    oneOf: '配置未匹配唯一的协议结构',
    anyOf: '配置未匹配任何允许的结构',
  }
  return { level: 'error', path, message: messages[error.keyword] ?? error.message ?? `Schema 校验失败：${error.keyword}` }
}

function uniqueIssues(issues: ValidationIssue[]) {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.level}|${issue.path}|${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function strings(value: unknown) {
  if (typeof value === 'string') return [value]
  return stringArray(value)
}

export class SingBoxConfigEngine implements ConfigEngine {
  readonly id = 'sing-box' as const
  readonly label = 'sing-box'

  createEmpty(): ConfigDocument {
    return {
      $schema: 'https://sing-box.sagernet.org/schema.json',
      log: { level: 'info', timestamp: true },
      inbounds: [],
      outbounds: [{ type: 'direct', tag: 'direct' }],
      route: { rules: [], final: 'direct' },
    }
  }

  parse(source: string): ImportResult {
    const errors: ParseError[] = []
    const value = parse(source.replace(/^\uFEFF/, ''), errors, { allowTrailingComma: true, disallowComments: false }) as unknown
    if (errors.length) throw new Error(errors.map((error) => parseErrorMessage(source, error)).join('\n'))
    if (!isRecord(value)) throw new Error('配置根节点必须是 JSON 对象')
    return { config: value, warnings: [] }
  }

  stringify(config: ConfigDocument) {
    return `${JSON.stringify(config, null, 2)}\n`
  }

  validate(config: ConfigDocument): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    if (!validator(config)) issues.push(...(validator.errors ?? []).map(schemaIssue))
    const add = (level: ValidationIssue['level'], path: string, message: string) => issues.push({ level, path, message })

    const inbounds = records(config.inbounds)
    const outbounds = records(config.outbounds)
    const inboundTags = inbounds.map((item) => String(item.tag || '')).filter(Boolean)
    const outboundTags = outbounds.map((item) => String(item.tag || '')).filter(Boolean)
    const knownOutbounds = new Set(outboundTags)
    for (const [kind, tags] of [['入站', inboundTags], ['出站', outboundTags]] as const) {
      for (const tag of new Set(tags.filter((value, index) => tags.indexOf(value) !== index))) add('error', kind === '入站' ? 'inbounds' : 'outbounds', `${kind}标签重复：${tag}`)
    }

    const route = isRecord(config.route) ? config.route : undefined
    const ruleSets = records(route?.rule_set)
    const ruleSetTags = ruleSets.flatMap((item) => strings(item.tag)).filter(Boolean)
    const knownRuleSets = new Set(ruleSetTags)
    const knownInbounds = new Set(inboundTags)
    const httpClients = records(config.http_clients)
    const httpClientTags = httpClients.map((item) => String(item.tag || '')).filter(Boolean)
    const knownHttpClients = new Set(httpClientTags)
    for (const tag of new Set(ruleSetTags.filter((value, index) => ruleSetTags.indexOf(value) !== index))) add('error', 'route.rule_set', `规则集标签重复：${tag}`)
    for (const tag of new Set(httpClientTags.filter((value, index) => httpClientTags.indexOf(value) !== index))) add('error', 'http_clients', `HTTP Client 标签重复：${tag}`)
    if (route?.final && !knownOutbounds.has(String(route.final))) add('error', 'route.final', `引用了不存在的出站：${String(route.final)}`)
    if (route?.default_http_client && !knownHttpClients.has(String(route.default_http_client))) add('error', 'route.default_http_client', `引用了不存在的 HTTP Client：${String(route.default_http_client)}`)
    ruleSets.forEach((ruleSet, index) => {
      if (typeof ruleSet.http_client === 'string' && !knownHttpClients.has(ruleSet.http_client)) add('error', `route.rule_set.${index}.http_client`, `引用了不存在的 HTTP Client：${ruleSet.http_client}`)
      if (ruleSet.type === 'remote' && !ruleSet.http_client && !route?.default_http_client && !httpClients.length) add('warning', `route.rule_set.${index}.http_client`, 'sing-box 1.14 已弃用隐式下载客户端，建议配置 HTTP Client')
    })
    const visitRouteRules = (value: unknown, base: string) => {
      records(value).forEach((rule, index) => {
        const path = `${base}.${index}`
        const action = String(rule.action || '')
        const targets = strings(rule.outbound)
        if ((!action || action === 'route') && targets.length) for (const target of targets) if (!knownOutbounds.has(target)) add('error', `${path}.outbound`, `引用了不存在的出站：${target}`)
        for (const tag of strings(rule.rule_set)) if (!knownRuleSets.has(tag)) add('error', `${path}.rule_set`, `引用了不存在的规则集：${tag}`)
        for (const tag of strings(rule.inbound)) if (!knownInbounds.has(tag)) add('error', `${path}.inbound`, `引用了不存在的入站：${tag}`)
        if (rule.rules) visitRouteRules(rule.rules, `${path}.rules`)
      })
    }
    if (route?.rules) visitRouteRules(route.rules, 'route.rules')

    outbounds.forEach((outbound, index) => {
      const path = `outbounds.${index}`
      const tag = String(outbound.tag || '')
      const members = stringArray(outbound.outbounds)
      for (const target of members) {
        if (!knownOutbounds.has(target)) add('error', `${path}.outbounds`, `引用了不存在的出站：${target}`)
        if (tag && target === tag) add('error', `${path}.outbounds`, '代理组不能引用自身')
      }
      if (['selector', 'urltest'].includes(String(outbound.type)) && !members.length) add('error', `${path}.outbounds`, '代理组至少需要一个成员')
      if (outbound.default && !members.includes(String(outbound.default))) add('error', `${path}.default`, `默认出站不在组内：${String(outbound.default)}`)
      if (outbound.detour && !knownOutbounds.has(String(outbound.detour))) add('error', `${path}.detour`, `引用了不存在的出站：${String(outbound.detour)}`)
    })

    const groupGraph = new Map<string, string[]>()
    outbounds.forEach((outbound) => {
      const tag = String(outbound.tag || '')
      if (tag && ['selector', 'urltest'].includes(String(outbound.type))) groupGraph.set(tag, stringArray(outbound.outbounds).filter((member) => groupGraph.has(member) || outbounds.some((item) => item.tag === member && ['selector', 'urltest'].includes(String(item.type)))))
    })
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visitGroup = (tag: string, chain: string[]) => {
      if (visiting.has(tag)) {
        const start = chain.indexOf(tag)
        add('error', 'outbounds', `代理组存在循环引用：${[...chain.slice(start), tag].join(' → ')}`)
        return
      }
      if (visited.has(tag)) return
      visiting.add(tag)
      for (const member of groupGraph.get(tag) ?? []) visitGroup(member, [...chain, tag])
      visiting.delete(tag)
      visited.add(tag)
    }
    for (const tag of groupGraph.keys()) visitGroup(tag, [])

    const dns = isRecord(config.dns) ? config.dns : undefined
    const dnsServers = records(dns?.servers)
    const dnsTags = dnsServers.map((item) => String(item.tag || '')).filter(Boolean)
    const knownDnsServers = new Set(dnsTags)
    for (const tag of new Set(dnsTags.filter((value, index) => dnsTags.indexOf(value) !== index))) add('error', 'dns.servers', `DNS 服务器标签重复：${tag}`)
    if (dns?.final && !knownDnsServers.has(String(dns.final))) add('error', 'dns.final', `引用了不存在的 DNS 服务器：${String(dns.final)}`)
    records(dns?.rules).forEach((rule, index) => {
      for (const tag of strings(rule.rule_set)) if (!knownRuleSets.has(tag)) add('error', `dns.rules.${index}.rule_set`, `引用了不存在的规则集：${tag}`)
      if (rule.server && !knownDnsServers.has(String(rule.server))) add('error', `dns.rules.${index}.server`, `引用了不存在的 DNS 服务器：${String(rule.server)}`)
    })
    dnsServers.forEach((server, index) => {
      if (server.detour && !knownOutbounds.has(String(server.detour))) add('error', `dns.servers.${index}.detour`, `引用了不存在的出站：${String(server.detour)}`)
    })
    httpClients.forEach((client, index) => {
      if (client.detour && !knownOutbounds.has(String(client.detour))) add('error', `http_clients.${index}.detour`, `引用了不存在的出站：${String(client.detour)}`)
    })

    return uniqueIssues(issues)
  }
}
