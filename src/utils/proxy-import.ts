import { parse } from 'yaml'

type ProxyRecord = Record<string, unknown>

function isRecord(value: unknown): value is ProxyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function records(value: unknown): ProxyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function decodeBase64(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function label(url: URL, fallback: string) {
  return decodeURIComponent(url.hash.replace(/^#/, '')) || fallback
}

function tlsFromUrl(url: URL) {
  const security = url.searchParams.get('security') || url.searchParams.get('tls')
  if (!security || ['none', 'false', '0'].includes(security)) return undefined
  const tls: ProxyRecord = { enabled: true }
  const serverName = url.searchParams.get('sni') || url.searchParams.get('peer')
  if (serverName) tls.server_name = serverName
  if (url.searchParams.get('allowInsecure') === '1' || url.searchParams.get('insecure') === '1') tls.insecure = true
  const alpn = url.searchParams.get('alpn')
  if (alpn) tls.alpn = alpn.split(',').filter(Boolean)
  return tls
}

function transportFromUrl(url: URL) {
  const type = url.searchParams.get('type') || url.searchParams.get('network')
  if (!type || type === 'tcp') return undefined
  const transport: ProxyRecord = { type }
  const path = url.searchParams.get('path')
  const host = url.searchParams.get('host')
  const serviceName = url.searchParams.get('serviceName')
  if (path) transport.path = path
  if (host) transport.headers = { Host: host }
  if (serviceName) transport.service_name = serviceName
  return transport
}

function parseStandardUri(source: string, target: 'mihomo' | 'sing-box'): ProxyRecord {
  const url = new URL(source)
  const scheme = url.protocol.replace(':', '').toLowerCase()
  const name = label(url, `${scheme}-${url.hostname}`)
  const port = number(url.port, 443)
  const user = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)

  if (target === 'mihomo') {
    const type = scheme === 'socks' || scheme === 'socks5' ? 'socks5' : scheme === 'hy2' ? 'hysteria2' : scheme === 'anytls' ? 'anytls' : scheme
    const value: ProxyRecord = { name, type, server: url.hostname, port }
    if (['vless', 'vmess'].includes(type)) value.uuid = user
    else if (type === 'tuic') { value.uuid = user; value.password = password }
    else if (['socks5', 'http'].includes(type)) { if (user) value.username = user; if (password) value.password = password }
    else if (user || password) value.password = password || user
    const tls = tlsFromUrl(url)
    if (tls) {
      value.tls = true
      if (tls.server_name) value.servername = tls.server_name
      if (tls.insecure) value['skip-cert-verify'] = true
      if (tls.alpn) value.alpn = tls.alpn
    }
    const transport = transportFromUrl(url)
    if (transport?.type) {
      value.network = transport.type
      if (transport.type === 'ws') value['ws-opts'] = { path: transport.path || '/', ...(transport.headers ? { headers: transport.headers } : {}) }
      if (transport.type === 'grpc') value['grpc-opts'] = { 'grpc-service-name': transport.service_name || '' }
    }
    const flow = url.searchParams.get('flow')
    if (flow) value.flow = flow
    return value
  }

  const type = scheme === 'ss' ? 'shadowsocks' : scheme === 'socks5' ? 'socks' : scheme === 'hy2' ? 'hysteria2' : scheme
  const value: ProxyRecord = { type, tag: name, server: url.hostname, server_port: port }
  if (['vless', 'vmess'].includes(type)) value.uuid = user
  else if (type === 'tuic') { value.uuid = user; value.password = password }
  else if (['socks', 'http'].includes(type)) { if (user) value.username = user; if (password) value.password = password }
  else if (user || password) value.password = password || user
  const tls = tlsFromUrl(url)
  if (tls) value.tls = tls
  const transport = transportFromUrl(url)
  if (transport) value.transport = transport
  const flow = url.searchParams.get('flow')
  if (flow) value.flow = flow
  return value
}

function parseShadowsocks(source: string, target: 'mihomo' | 'sing-box') {
  const hashIndex = source.indexOf('#')
  const name = hashIndex >= 0 ? decodeURIComponent(source.slice(hashIndex + 1)) : 'shadowsocks'
  const withoutHash = source.slice(5, hashIndex >= 0 ? hashIndex : undefined)
  const queryIndex = withoutHash.indexOf('?')
  const body = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  let decoded = body
  if (!body.includes('@')) decoded = decodeBase64(body)
  const at = decoded.lastIndexOf('@')
  if (at < 0) throw new Error('Shadowsocks 链接缺少服务器地址')
  let credentials = decoded.slice(0, at)
  if (!credentials.includes(':')) credentials = decodeBase64(credentials)
  const separator = credentials.indexOf(':')
  const method = decodeURIComponent(credentials.slice(0, separator))
  const password = decodeURIComponent(credentials.slice(separator + 1))
  const serverUrl = new URL(`ss://${decoded.slice(at + 1)}`)
  if (target === 'mihomo') return { name, type: 'ss', server: serverUrl.hostname, port: number(serverUrl.port), cipher: method, password, udp: true }
  return { tag: name, type: 'shadowsocks', server: serverUrl.hostname, server_port: number(serverUrl.port), method, password }
}

function parseVmess(source: string, target: 'mihomo' | 'sing-box') {
  const value = JSON.parse(decodeBase64(source.slice('vmess://'.length))) as ProxyRecord
  const name = String(value.ps || value.name || 'vmess')
  const server = String(value.add || value.server || '')
  const port = number(value.port, 443)
  const uuid = String(value.id || value.uuid || '')
  if (target === 'mihomo') {
    const proxy: ProxyRecord = { name, type: 'vmess', server, port, uuid, alterId: number(value.aid), cipher: String(value.scy || 'auto') }
    if (value.tls && value.tls !== 'none') { proxy.tls = true; if (value.sni) proxy.servername = value.sni }
    if (value.net && value.net !== 'tcp') proxy.network = value.net
    if (value.net === 'ws') proxy['ws-opts'] = { path: value.path || '/', ...(value.host ? { headers: { Host: value.host } } : {}) }
    return proxy
  }
  const outbound: ProxyRecord = { tag: name, type: 'vmess', server, server_port: port, uuid, security: String(value.scy || 'auto'), alter_id: number(value.aid) }
  if (value.tls && value.tls !== 'none') outbound.tls = { enabled: true, ...(value.sni ? { server_name: value.sni } : {}) }
  if (value.net && value.net !== 'tcp') outbound.transport = { type: value.net, ...(value.path ? { path: value.path } : {}), ...(value.host ? { headers: { Host: value.host } } : {}) }
  return outbound
}

export function mihomoToSingBox(proxy: ProxyRecord): ProxyRecord {
  const typeMap: Record<string, string> = { ss: 'shadowsocks', socks5: 'socks' }
  const type = typeMap[String(proxy.type || '')] || String(proxy.type || '')
  const value: ProxyRecord = { type, tag: String(proxy.name || `${type}-out`) }
  for (const key of ['server', 'uuid', 'username', 'password', 'flow']) if (proxy[key] !== undefined) value[key] = proxy[key]
  if (proxy.port !== undefined) value.server_port = proxy.port
  if (proxy.cipher !== undefined) value.method = proxy.cipher
  if (proxy.alterId !== undefined) value.alter_id = proxy.alterId
  if (proxy.tls === true) value.tls = { enabled: true, ...(proxy.servername ? { server_name: proxy.servername } : {}), ...(proxy['skip-cert-verify'] ? { insecure: true } : {}) }
  if (proxy.network && proxy.network !== 'tcp') value.transport = { type: proxy.network }
  if (proxy.network === 'ws' && isRecord(proxy['ws-opts'])) value.transport = { type: 'ws', ...proxy['ws-opts'] }
  return value
}

export function singBoxToMihomo(outbound: ProxyRecord): ProxyRecord {
  const typeMap: Record<string, string> = { shadowsocks: 'ss', socks: 'socks5' }
  const type = typeMap[String(outbound.type || '')] || String(outbound.type || '')
  const value: ProxyRecord = { type, name: String(outbound.tag || `${type}-proxy`) }
  for (const key of ['server', 'uuid', 'username', 'password', 'flow']) if (outbound[key] !== undefined) value[key] = outbound[key]
  if (outbound.server_port !== undefined) value.port = outbound.server_port
  if (outbound.method !== undefined) value.cipher = outbound.method
  if (outbound.alter_id !== undefined) value.alterId = outbound.alter_id
  if (isRecord(outbound.tls) && outbound.tls.enabled !== false) {
    value.tls = true
    if (outbound.tls.server_name) value.servername = outbound.tls.server_name
    if (outbound.tls.insecure) value['skip-cert-verify'] = true
  }
  if (isRecord(outbound.transport) && outbound.transport.type) {
    value.network = outbound.transport.type
    if (outbound.transport.type === 'ws') value['ws-opts'] = Object.fromEntries(Object.entries(outbound.transport).filter(([key]) => key !== 'type'))
  }
  return value
}

function parseStructured(source: string, target: 'mihomo' | 'sing-box') {
  let value: unknown
  try { value = parse(source) } catch { return [] }
  if (Array.isArray(value)) {
    const list = records(value)
    if (target === 'sing-box' && list.some((item) => item.name !== undefined && item.tag === undefined)) return list.map(mihomoToSingBox)
    if (target === 'mihomo' && list.some((item) => item.tag !== undefined && item.name === undefined)) return list.map(singBoxToMihomo)
    return list
  }
  if (!isRecord(value)) return []
  if (target === 'mihomo') {
    if (Array.isArray(value.proxies)) return records(value.proxies)
    if (Array.isArray(value.outbounds)) return records(value.outbounds).filter((item) => !['selector', 'urltest', 'direct', 'block'].includes(String(item.type))).map(singBoxToMihomo)
    if (value.type && (value.name || value.server)) return [value]
  } else {
    if (Array.isArray(value.outbounds)) return records(value.outbounds)
    if (Array.isArray(value.proxies)) return records(value.proxies).map(mihomoToSingBox)
    if (value.type && (value.tag || value.server)) return [value]
  }
  return []
}

export function parseProxyInput(source: string, target: 'mihomo' | 'sing-box'): ProxyRecord[] {
  const structured = parseStructured(source.trim(), target)
  if (structured.length) return structured
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  return lines.map((line) => {
    if (line.startsWith('ss://')) return parseShadowsocks(line, target)
    if (line.startsWith('vmess://')) return parseVmess(line, target)
    if (/^(vless|trojan|hysteria2|hy2|tuic|socks|socks5|http|anytls):\/\//i.test(line)) return parseStandardUri(line, target)
    throw new Error(`无法识别的节点内容：${line.slice(0, 48)}`)
  })
}
