import type { ConfigModuleSchema } from './types'

const yesNo = [
  { label: '关闭', value: 'false' },
  { label: '开启', value: 'true' },
]

export const mihomoModules: ConfigModuleSchema[] = [
  {
    id: 'general', label: '全局配置', icon: 'settings', kind: 'form', docsPath: '/config/general/',
    description: '端口、运行模式、局域网、GeoData 与连接保活。',
    sections: [
      { id: 'ports', title: '代理端口', description: '配置各协议的监听端口', defaultOpen: true, fields: [
        { path: 'mixed-port', label: '混合端口', type: 'number', min: 1, max: 65535, placeholder: '7890', description: '同时支持 HTTP 与 SOCKS5' },
        { path: 'port', label: 'HTTP 端口', type: 'number', min: 1, max: 65535, placeholder: '7890' },
        { path: 'socks-port', label: 'SOCKS5 端口', type: 'number', min: 1, max: 65535, placeholder: '7891' },
        { path: 'redir-port', label: 'Redirect 端口', type: 'number', min: 1, max: 65535, placeholder: '7892' },
        { path: 'tproxy-port', label: 'TProxy 端口', type: 'number', min: 1, max: 65535, placeholder: '7893' },
      ]},
      { id: 'basic', title: '基本设置', fields: [
        { path: 'mode', label: '运行模式', type: 'select', options: [{ label: '规则', value: 'rule' }, { label: '全局', value: 'global' }, { label: '直连', value: 'direct' }] },
        { path: 'log-level', label: '日志等级', type: 'select', options: ['silent','error','warning','info','debug'].map(value => ({ label: value, value })) },
        { path: 'ipv6', label: 'IPv6', type: 'switch', options: yesNo },
        { path: 'unified-delay', label: '统一延迟', type: 'switch' },
        { path: 'tcp-concurrent', label: 'TCP 并发', type: 'switch' },
        { path: 'find-process-mode', label: '进程匹配', type: 'select', options: ['strict','always','off'].map(value => ({ label: value, value })) },
        { path: 'global-client-fingerprint', label: '全局 TLS 指纹', type: 'select', options: ['chrome','firefox','safari','ios','android','edge','360','qq','random'].map(value => ({ label: value, value })) },
      ]},
      { id: 'lan', title: '局域网设置', fields: [
        { path: 'allow-lan', label: '允许局域网', type: 'switch' },
        { path: 'bind-address', label: '绑定地址', type: 'text', placeholder: '*' },
        { path: 'authentication', label: '认证账户', type: 'tags', placeholder: 'user:password，回车添加' },
        { path: 'skip-auth-prefixes', label: '免认证网段', type: 'tags', placeholder: '127.0.0.1/8' },
        { path: 'lan-allowed-ips', label: '允许访问网段', type: 'tags', placeholder: '0.0.0.0/0' },
        { path: 'lan-disallowed-ips', label: '拒绝访问网段', type: 'tags', placeholder: '192.168.0.3/32' },
      ]},
      { id: 'geodata', title: 'GeoData 配置', fields: [
        { path: 'geodata-mode', label: 'GeoData 模式', type: 'switch' },
        { path: 'geodata-loader', label: '加载器', type: 'select', options: ['standard','memconservative'].map(value => ({ label: value, value })) },
        { path: 'geo-auto-update', label: '自动更新', type: 'switch' },
        { path: 'geo-update-interval', label: '更新间隔（小时）', type: 'number', min: 1, placeholder: '24' },
      ]},
      { id: 'keepalive', title: 'Keep Alive', fields: [
        { path: 'keep-alive-interval', label: '探测间隔（秒）', type: 'number', min: 0, placeholder: '15' },
        { path: 'keep-alive-idle', label: '空闲时间（秒）', type: 'number', min: 0, placeholder: '600' },
        { path: 'disable-keep-alive', label: '禁用 Keep Alive', type: 'switch' },
      ]},
    ],
  },
  { id: 'proxies', label: '代理节点', icon: 'globe', kind: 'proxies', rootKey: 'proxies', docsPath: '/config/proxies/', description: '添加与管理不同协议的代理节点。' },
  { id: 'groups', label: '代理组', icon: 'users', kind: 'groups', rootKey: 'proxy-groups', docsPath: '/config/proxy-groups/', description: '编排选择、自动测速、负载均衡等策略组。' },
  { id: 'proxy-providers', label: '代理集合', icon: 'cloud', kind: 'providers', rootKey: 'proxy-providers', docsPath: '/config/proxy-providers/', description: '维护远程订阅或本地代理集合。' },
  { id: 'rule-providers', label: '规则集合', icon: 'file', kind: 'providers', rootKey: 'rule-providers', docsPath: '/config/rule-providers/', description: '维护规则集合来源、行为和更新策略。' },
  { id: 'rules', label: '路由规则', icon: 'route', kind: 'rules', rootKey: 'rules', docsPath: '/config/rules/', description: '按顺序编辑路由匹配规则。' },
  {
    id: 'dns', label: 'DNS 配置', icon: 'activity', kind: 'form', docsPath: '/config/dns/', description: '解析模式、上游服务器与 Fake-IP 行为。',
    sections: [
      { id: 'dns-basic', title: '基本设置', defaultOpen: true, fields: [
        { path: 'dns.enable', label: '启用 DNS', type: 'switch' },
        { path: 'dns.listen', label: '监听地址', type: 'text', placeholder: '0.0.0.0:1053' },
        { path: 'dns.ipv6', label: 'IPv6 解析', type: 'switch' },
        { path: 'dns.enhanced-mode', label: '增强模式', type: 'select', options: ['fake-ip','redir-host'].map(value => ({ label: value, value })) },
        { path: 'dns.fake-ip-range', label: 'Fake-IP 地址池', type: 'text', placeholder: '198.18.0.1/16' },
        { path: 'dns.fake-ip-filter-mode', label: '过滤模式', type: 'select', options: ['blacklist','whitelist'].map(value => ({ label: value, value })) },
        { path: 'dns.respect-rules', label: '遵循路由规则', type: 'switch' },
      ]},
      { id: 'dns-upstream', title: '上游服务器', fields: [
        { path: 'dns.default-nameserver', label: '默认 DNS', type: 'tags', placeholder: '223.5.5.5' },
        { path: 'dns.nameserver', label: '主要 DNS', type: 'tags', placeholder: 'https://dns.alidns.com/dns-query' },
        { path: 'dns.proxy-server-nameserver', label: '代理节点 DNS', type: 'tags', placeholder: 'https://doh.pub/dns-query' },
        { path: 'dns.direct-nameserver', label: '直连 DNS', type: 'tags', placeholder: 'system' },
        { path: 'dns.fallback', label: 'Fallback DNS', type: 'tags', placeholder: 'tls://8.8.4.4' },
      ]},
      { id: 'dns-filter', title: 'Fake-IP 过滤', fields: [
        { path: 'dns.fake-ip-filter', label: '过滤规则', type: 'tags', placeholder: '+.lan' },
      ]},
    ],
  },
  {
    id: 'tls', label: 'TLS 配置', icon: 'lock', kind: 'form', docsPath: '/config/general/#tls', description: '配置控制器 HTTPS 证书与 ECH 密钥。', sections: [
      { id: 'tls-main', title: '证书设置', defaultOpen: true, fields: [
        { path: 'tls.certificate', label: '证书路径', type: 'text', placeholder: '/etc/mihomo/cert.pem' },
        { path: 'tls.private-key', label: '私钥路径', type: 'text', placeholder: '/etc/mihomo/key.pem' },
        { path: 'tls.ech-key', label: 'ECH 密钥', type: 'textarea', placeholder: '-----BEGIN ECH KEYS-----' },
      ]},
    ],
  },
  {
    id: 'controller', label: '外部控制', icon: 'monitor', kind: 'form', docsPath: '/config/general/#api', description: 'API、控制面板和跨域访问配置。', sections: [
      { id: 'api', title: '控制器 API', defaultOpen: true, fields: [
        { path: 'external-controller', label: 'HTTP API', type: 'text', placeholder: '127.0.0.1:9090' },
        { path: 'external-controller-tls', label: 'HTTPS API', type: 'text', placeholder: '127.0.0.1:9443' },
        { path: 'secret', label: 'API 密钥', type: 'text', placeholder: '建议设置高强度密钥' },
      ]},
      { id: 'ui', title: '外部面板', fields: [
        { path: 'external-ui', label: '面板目录', type: 'text', placeholder: 'ui' },
        { path: 'external-ui-name', label: '面板子目录', type: 'text', placeholder: 'metacubexd' },
        { path: 'external-ui-url', label: '面板下载地址', type: 'text', placeholder: 'https://...' },
      ]},
      { id: 'cors', title: 'CORS', fields: [
        { path: 'external-controller-cors.allow-origins', label: '允许来源', type: 'tags', placeholder: 'https://panel.example.com' },
        { path: 'external-controller-cors.allow-private-network', label: '允许私有网络', type: 'switch' },
      ]},
    ],
  },
  {
    id: 'profile', label: 'Profile', icon: 'user', kind: 'form', docsPath: '/config/general/#profile', description: '持久化策略选择和 Fake-IP 映射。', sections: [
      { id: 'profile-main', title: '持久化设置', defaultOpen: true, fields: [
        { path: 'profile.store-selected', label: '保存策略选择', type: 'switch' },
        { path: 'profile.store-fake-ip', label: '保存 Fake-IP', type: 'switch' },
      ]},
    ],
  },
  {
    id: 'tun', label: 'TUN 配置', icon: 'layers', kind: 'form', docsPath: '/config/inbound/tun/', description: '系统栈、路由接管、DNS 劫持与网卡设置。', sections: [
      { id: 'tun-basic', title: '基本设置', defaultOpen: true, fields: [
        { path: 'tun.enable', label: '启用 TUN', type: 'switch' },
        { path: 'tun.stack', label: '网络栈', type: 'select', options: ['mixed','system','gvisor'].map(value => ({ label: value, value })) },
        { path: 'tun.device', label: '设备名', type: 'text', placeholder: 'Mihomo' },
        { path: 'tun.mtu', label: 'MTU', type: 'number', min: 576, max: 9000, placeholder: '9000' },
        { path: 'tun.dns-hijack', label: 'DNS 劫持', type: 'tags', placeholder: 'any:53' },
        { path: 'tun.auto-route', label: '自动路由', type: 'switch' },
        { path: 'tun.auto-redirect', label: '自动重定向', type: 'switch' },
        { path: 'tun.auto-detect-interface', label: '自动检测网卡', type: 'switch' },
        { path: 'tun.strict-route', label: '严格路由', type: 'switch' },
      ]},
      { id: 'tun-route', title: '路由范围', fields: [
        { path: 'tun.route-address', label: '包含网段', type: 'tags', placeholder: '0.0.0.0/1' },
        { path: 'tun.route-exclude-address', label: '排除网段', type: 'tags', placeholder: '192.168.0.0/16' },
        { path: 'tun.include-interface', label: '包含网卡', type: 'tags', placeholder: 'WLAN' },
        { path: 'tun.exclude-interface', label: '排除网卡', type: 'tags', placeholder: 'docker0' },
      ]},
    ],
  },
  {
    id: 'sniffer', label: '域名嗅探', icon: 'search', kind: 'form', docsPath: '/config/sniff/', description: '从流量中还原域名并改善规则匹配。', sections: [
      { id: 'sniffer-basic', title: '嗅探设置', defaultOpen: true, fields: [
        { path: 'sniffer.enable', label: '启用嗅探', type: 'switch' },
        { path: 'sniffer.force-dns-mapping', label: '强制 DNS 映射', type: 'switch' },
        { path: 'sniffer.parse-pure-ip', label: '解析纯 IP', type: 'switch' },
        { path: 'sniffer.override-destination', label: '覆盖目标地址', type: 'switch' },
        { path: 'sniffer.force-domain', label: '强制嗅探域名', type: 'tags', placeholder: '+.v2ex.com' },
        { path: 'sniffer.skip-domain', label: '跳过域名', type: 'tags', placeholder: 'Mijia Cloud' },
        { path: 'sniffer.skip-src-address', label: '跳过来源地址', type: 'tags', placeholder: '192.168.0.3/32' },
        { path: 'sniffer.skip-dst-address', label: '跳过目标地址', type: 'tags', placeholder: '192.168.0.3/32' },
      ]},
    ],
  },
  { id: 'hosts', label: 'Hosts', icon: 'hexagon', kind: 'record', rootKey: 'hosts', docsPath: '/config/hosts/', description: '维护静态域名与地址映射。' },
  { id: 'tunnels', label: '流量隧道', icon: 'zap', kind: 'raw-list', rootKey: 'tunnels', docsPath: '/config/tunnels/', description: '配置 TCP/UDP 端口转发隧道。' },
  { id: 'listeners', label: '入站监听', icon: 'grid', kind: 'raw-list', rootKey: 'listeners', docsPath: '/config/inbound/listeners/', description: '配置额外的协议入站监听器。' },
]
