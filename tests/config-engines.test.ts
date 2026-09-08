import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MihomoConfigEngine } from '@/adapters/mihomo/MihomoConfigEngine'
import { SingBoxConfigEngine } from '@/adapters/singbox/SingBoxConfigEngine'

describe('MihomoConfigEngine', () => {
  const engine = new MihomoConfigEngine()

  it.each(['ebpf国外.yaml', '热点配置.yaml', '自用-优化.yaml', '自用-国外.yaml'])('parses the existing %s configuration', (name) => {
    const result = engine.parse(readFileSync(resolve(process.cwd(), '..', name), 'utf8'))
    expect(result.config).toBeTypeOf('object')
    expect(engine.validate(result.config).filter((issue) => issue.level === 'error')).toEqual([])
  })

  it('rejects duplicate YAML keys', () => {
    expect(() => engine.parse('mode: rule\nmode: direct\n')).toThrow()
  })

  it('finds invalid ports and missing references', () => {
    const issues = engine.validate({
      mode: 'rule',
      'mixed-port': 70000,
      'proxy-groups': [{ name: '选择', type: 'select', proxies: ['不存在'] }],
      rules: ['MATCH,不存在'],
    })
    expect(issues.some((issue) => issue.path === 'mixed-port' && issue.level === 'error')).toBe(true)
    expect(issues.some((issue) => issue.path === 'proxy-groups.0.proxies')).toBe(true)
    expect(issues.some((issue) => issue.path === 'rules.0')).toBe(true)
  })
})

describe('SingBoxConfigEngine', () => {
  const engine = new SingBoxConfigEngine()

  it('accepts the generated configuration', () => {
    expect(engine.validate(engine.createEmpty())).toEqual([])
  })

  it('parses JSONC comments and trailing commas', () => {
    const result = engine.parse('{ // comment\n "outbounds": [{"type":"direct","tag":"direct"}],\n}')
    expect(result.config.outbounds).toBeInstanceOf(Array)
  })

  it('uses the official schema and detects broken references', () => {
    const issues = engine.validate({
      unexpected: true,
      outbounds: [{ type: 'direct', tag: 'direct' }],
      route: { final: 'missing' },
    })
    expect(issues.some((issue) => issue.message.includes('不受支持'))).toBe(true)
    expect(issues.some((issue) => issue.path === 'route.final' && issue.message.includes('不存在'))).toBe(true)
  })

  it('accepts visual proxy groups, DNS, rule sets and route rules', () => {
    const issues = engine.validate({
      log: { level: 'info', timestamp: true },
      http_clients: [{ tag: 'rule-set-download', engine: 'go' }],
      inbounds: [{ type: 'mixed', tag: 'mixed-in', listen: '::', listen_port: 7890 }],
      outbounds: [
        { type: 'direct', tag: 'direct' },
        { type: 'selector', tag: 'proxy', outbounds: ['direct'], default: 'direct' },
        { type: 'urltest', tag: 'auto', outbounds: ['proxy'], url: 'https://www.gstatic.com/generate_204', interval: '3m', tolerance: 50 },
      ],
      dns: {
        servers: [
          { type: 'local', tag: 'local' },
          { type: 'https', tag: 'cloudflare', server: '1.1.1.1', server_port: 443, path: '/dns-query', tls: { enabled: true, server_name: 'cloudflare-dns.com' } },
        ],
        final: 'local',
        strategy: 'prefer_ipv4',
      },
      route: {
        rule_set: [{ type: 'remote', tag: 'geosite-cn', format: 'binary', url: 'https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs', update_interval: '1d' }],
        rules: [{ rule_set: 'geosite-cn', inbound: 'mixed-in', action: 'route', outbound: 'direct' }],
        final: 'proxy',
        default_http_client: 'rule-set-download',
        auto_detect_interface: true,
      },
    })
    expect(issues).toEqual([])
  })

  it('detects missing tags and cyclic nested proxy groups', () => {
    const issues = engine.validate({
      inbounds: [{ type: 'mixed', tag: 'mixed-in', listen_port: 7890 }],
      outbounds: [
        { type: 'selector', tag: 'group-a', outbounds: ['group-b'] },
        { type: 'urltest', tag: 'group-b', outbounds: ['group-a'] },
      ],
      dns: { servers: [{ type: 'local', tag: 'local' }], rules: [{ rule_set: 'missing-set', action: 'route', server: 'missing-dns' }] },
      route: { rules: [{ inbound: 'missing-in', rule_set: 'missing-set', action: 'route', outbound: 'missing-out' }], final: 'group-a' },
    })
    expect(issues.some((issue) => issue.message.includes('循环引用'))).toBe(true)
    expect(issues.some((issue) => issue.path === 'route.rules.0.rule_set')).toBe(true)
    expect(issues.some((issue) => issue.path === 'route.rules.0.inbound')).toBe(true)
    expect(issues.some((issue) => issue.path === 'dns.rules.0.server')).toBe(true)
  })
})
