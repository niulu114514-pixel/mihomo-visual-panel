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
})
