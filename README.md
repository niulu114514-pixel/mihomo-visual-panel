# Mihomo Flow

一套基于 Vue 3、Vite、TypeScript、Pinia、Vue Router、Naive UI 与 CodeMirror 6 的 Mihomo 可视化配置生成器，专注流畅性、配置安全和后续多内核扩展。

## 功能

- 三栏配置工作台：模块导航、可视化表单、实时 YAML 预览
- Naive UI 表单、折叠面板、弹窗、通知与操作反馈
- CodeMirror 6 行号、YAML 语法高亮和源码编辑
- 新建、导入现有 YAML、源码编辑、复制、验证和导出
- 全局、代理节点、代理组、代理/规则集合、路由规则、DNS、TLS、外部控制、Profile、TUN、嗅探、Hosts、隧道和入站监听
- 未被表单识别的字段在导入和导出过程中仍会完整保留
- 草稿自动保存在当前浏览器，刷新后可恢复
- 响应式桌面/移动端界面

## 页面路由

配置模块使用 Hash Router，可在 Cloudflare Pages 和 EdgeOne 上直接刷新，无需额外配置回退规则：

```text
#/mihomo/general
#/mihomo/proxies
#/mihomo/groups
#/mihomo/dns
#/mihomo/tun
#/sing-box/          sing-box JSON/JSONC 校验工作台
```

面板不会直接修改磁盘上的 YAML。只有用户主动编辑并导出时才会生成新文件；导入现有配置不会自动重排或改写代理组内容。

## 本地开发

要求 Node.js 20+，推荐 pnpm。

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm preview
```

## 数据与隐私

配置解析、验证和导出全部在浏览器本地完成，不上传配置文件，也不需要连接 Mihomo 控制器。请注意：草稿会自动写入当前站点的 `localStorage`；在共享设备上使用后可点击“新建”清除草稿。

## 部署到 Cloudflare Pages

在 Cloudflare Pages 连接此 Git 仓库，构建设置为：

```text
Build command: pnpm build
Build output directory: dist
Node.js: 22
```

项目是纯静态单页应用。`public/_headers` 会为 Cloudflare Pages 添加基本安全头及静态资源缓存策略。

## 部署到 EdgeOne Makers / Pages

在 EdgeOne Makers 导入此 Git 仓库即可。仓库根目录的 `edgeone.json` 已声明：

```text
Install command: npx pnpm@11.19.0 install --frozen-lockfile
Build command: npx pnpm@11.19.0 build
Output directory: dist
Node.js: 22.17.1
```

如果项目是通过 GitHub 导入的，推送 `main` 分支会自动触发部署。CLI 直接上传只适用于创建时选择“直接上传”的项目，不能覆盖 GitHub 关联型项目：

```bash
npm install -g edgeone
edgeone login
edgeone makers deploy ./dist -n mihomo-visual-panel
```

## 可维护性

配置界面由 schema 驱动，解析、序列化和验证由独立的 `ConfigEngine` 实现。Mihomo 代理组使用完整字段化表单，代理/规则集合、隧道、监听和 Hosts 也均可视化编辑；未知扩展字段在表单保存时原样保留。sing-box 已接入 JSON/JSONC 编辑、官方 Draft 2020-12 Schema 校验和标签引用检查。实现细节见 [架构说明](docs/ARCHITECTURE.md)。

校验规则会阻止存在明确错误的配置导出。静态网页无法替代目标设备上的内核、远程订阅、文件路径和网络环境检查，上机前仍建议分别执行 `mihomo -t -f config.yaml` 或 `sing-box check -c config.json`。

## 安全说明

- 配置文件只在浏览器内处理，部署平台不接收用户导入的 YAML。
- `.env`、构建产物和本地凭据均不会进入 Git。
- 若密钥曾出现在聊天、日志或截图中，请立即轮换。

## 文档依据

- [Mihomo 官方 API 文档](https://wiki.metacubex.one/api/)
- [Mihomo 外部控制器配置](https://wiki.metacubex.one/config/general/)
- [Cloudflare Pages Vite 部署](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)
- [EdgeOne Vite 部署](https://pages.edgeone.ai/document/vite)
- [EdgeOne edgeone.json](https://pages.edgeone.ai/document/edgeone-json)

## License

MIT
