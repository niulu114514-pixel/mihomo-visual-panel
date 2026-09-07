# 架构说明

Mihomo Flow 将“配置格式”和“界面”分开，目标是让下一阶段的 sing-box 支持成为增量开发，而不是重写。

## 分层

```text
Vue 编辑器组件
      ↓
Vue Router（内核 / 配置模块）
      ↓
配置 Schema（模块、分组、字段）
      ↓
Pinia 配置文档状态
      ↓
ConfigEngine（解析、序列化、验证）
      ↓
Mihomo YAML / sing-box JSON/JSONC
```

- `src/core/config-engine.ts`：不同内核都要实现的稳定契约。
- `src/schemas/mihomo.ts`：Mihomo 表单和信息架构，新增普通字段通常只需增加 schema。
- `src/schemas/structured.ts`：代理/规则集合、隧道和监听的结构化字段定义，由通用集合编辑器渲染。
- `src/adapters/mihomo/MihomoConfigEngine.ts`：Mihomo YAML 的解析、序列化和语义验证。
- `src/stores/config.ts`：唯一配置文档、路径读写、草稿和导出。
- `src/components/`：表单、集合、Hosts、规则和 YAML 编辑器；高级未知字段在结构化编辑时保持原样。
- `src/router/`：按内核和模块组织 URL，页面组件使用懒加载。
- `src/components/YamlEditor.vue`：隔离 CodeMirror 生命周期与 Vue 状态同步。

## sing-box 现状与后续可视化

1. `src/adapters/singbox/SingBoxConfigEngine.ts` 已实现 JSON/JSONC 解析、序列化、官方 JSON Schema 与跨标签引用校验。
2. 官方 `https://sing-box.sagernet.org/schema.json` 已固定在仓库中，部署后校验不依赖外网。
3. `src/stores/singbox.ts` 使用独立草稿键，避免两个内核的配置相互覆盖。
4. 下一阶段新增 `src/schemas/singbox.ts` 与入站、出站、DNS、路由可视化组件时，继续复用稳定的 `ConfigEngine`、CodeMirror 和校验结果结构。

## 性能策略

- 表单由 schema 驱动，减少重复组件和维护成本。
- YAML 预览使用派生状态，编辑时无需网络请求。
- 大型规则列表只渲染当前筛选结果并支持分模块工作。
- 静态资源文件名带内容哈希，可由边缘平台长期缓存。

## 安全边界

本项目是静态前端。文件解析和生成都在浏览器内完成；自动草稿存储在当前站点的 `localStorage`，不会发送到部署平台。
