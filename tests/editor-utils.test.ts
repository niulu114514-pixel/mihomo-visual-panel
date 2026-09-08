import { describe, expect, it } from 'vitest'
import { parseProxyInput } from '@/utils/proxy-import'
import { sourceLineForPath } from '@/utils/source-location'

describe('proxy paste import', () => {
  it('imports proxy arrays from Mihomo YAML', () => {
    const values = parseProxyInput('proxies:\n  - name: node-a\n    type: ss\n    server: example.com\n    port: 443\n    cipher: aes-128-gcm\n    password: secret\n', 'mihomo')
    expect(values).toHaveLength(1)
    expect(values[0]).toMatchObject({ name: 'node-a', type: 'ss', server: 'example.com', port: 443 })
  })

  it('imports VLESS share links for both engines', () => {
    const link = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=edge.example.com&type=ws&path=%2Fws#Edge'
    expect(parseProxyInput(link, 'mihomo')[0]).toMatchObject({ name: 'Edge', type: 'vless', server: 'example.com', port: 443, tls: true, network: 'ws' })
    expect(parseProxyInput(link, 'sing-box')[0]).toMatchObject({ tag: 'Edge', type: 'vless', server: 'example.com', server_port: 443, tls: { enabled: true, server_name: 'edge.example.com' } })
  })

  it('converts Mihomo YAML nodes when importing into sing-box', () => {
    const values = parseProxyInput('- name: ss-a\n  type: ss\n  server: 1.2.3.4\n  port: 8388\n  cipher: chacha20-ietf-poly1305\n  password: secret\n', 'sing-box')
    expect(values[0]).toMatchObject({ tag: 'ss-a', type: 'shadowsocks', server_port: 8388, method: 'chacha20-ietf-poly1305' })
  })
})

describe('source path location', () => {
  it('locates nested YAML paths', () => {
    const source = 'mode: rule\nproxy-groups:\n  - name: proxy\n    proxies:\n      - DIRECT\n'
    expect(sourceLineForPath(source, 'proxy-groups.0.proxies', 'yaml')).toBe(4)
  })

  it('locates nested JSON paths and falls back to the parent for missing keys', () => {
    const source = '{\n  "route": {\n    "rules": []\n  }\n}\n'
    expect(sourceLineForPath(source, 'route.rules', 'json')).toBe(3)
    expect(sourceLineForPath(source, 'route.rules.0.outbound', 'json')).toBe(3)
  })
})
