# Cloud-Mail 个人API系统 开发计划

## M-API-001: 数据库模型设计与扩展

- [x] 扩展 User 实体 (`mail-worker/src/entity/user.js`)
  - [x] 增加布尔型字段 `can_create_api_keys` (默认为 `false`)。
- [x] 新建 ApiKey 实体 (`mail-worker/src/entity/api_key.js`)
  - [x] `id` (主键)
  - [x] `user_id` (外键, 关联 User)
  - [x] `description` (字符串, 用户自定义描述)
  - [x] `key_prefix` (字符串, 用于前端展示和索引)
  - [x] `hashed_key` (字符串, 哈希存储的完整Key)
  - [x] `created_at` (时间戳)
  - [x] `last_used_at` (时间戳, 可选)
- [x] 更新 ORM/D1 迁移脚本
  - [x] 将新的表和字段变更应用到数据库。

## M-API-002: 后端 - API-Key 管理逻辑 (内部接口)

- [ ] `GET /api/my/api-keys`: 获取当前用户的所有API-Key。
  - [ ] 仅返回非敏感信息 (如 `id`, `description`, `key_prefix`)。
- [ ] `POST /api/my/api-keys`: 创建一个新的API-Key。
  - [ ] 检查当前用户的 `can_create_api_keys` 权限。
  - [ ] 生成高熵随机Key。
  - [ ] 提取 `key_prefix`。
  - [ ] 哈希完整Key并存入 `hashed_key`。
  - [ ] 仅在响应中返回一次完整的明文Key。
- [ ] `DELETE /api/my/api-keys/:keyId`: 删除一个API-Key。
  - [ ] 校验 `keyId` 是否属于当前登录用户。

## M-API-003: 后端 - 超管权限控制 (内部接口)

- [ ] `PUT /api/users/:userId/api-permission`: 更新指定用户的API权限。
  - [ ] 确保此接口受Admin权限保护。
  - [ ] 接收 `{ can_create_api_keys: true/false }`。
  - [ ] 更新 User 表中对应用户的 `can_create_api_keys` 字段。

## M-API-004: 前端 - 用户API-Key管理界面

- [ ] 创建新UI组件 (例如 `mail-vue/src/views/setting/` 下的API管理Tab)。
  - [ ] **[权限]** 仅当 `user.can_create_api_keys` 为 `true` 时显示此Tab。
- [ ] **[显示]**
  - [ ] 调用 `GET /api/my/api-keys` 渲染Key列表 (表格形式)。
- [ ] **[创建]**
  - [ ] "生成新Key"按钮 -> 弹窗输入 `description`。
  - [ ] 调用 `POST /api/my/api-keys`。
  - [ ] **[安全]** 弹出模态框显示新Key，并包含醒目警告："请立即复制并妥善保存，此Key仅显示一次"。
- [ ] **[删除]**
  - [ ] "删除"按钮 -> 确认弹窗 -> 调用 `DELETE /api/my/api-keys/:keyId`。

## M-API-005: 前端 - 超管权限管理界面

- [ ] 修改用户管理界面 (`mail-vue/src/views/user/index.vue`)
  - [ ] 在用户表格中增加一列 "允许API访问"。
  - [ ] 使用 `el-switch` (Toggle开关) 绑定 M-API-003 的 `PUT` 接口。
  - [ ] 实时更新用户 `can_create_api_keys` 状态。

## M-API-006: 后端 - 核心：API-Key 认证中间件

- [ ] 创建 `apiKeyAuthMiddleware` (`mail-worker/src/security/security.js`)
  - [ ] 从请求头中检查 `X-API-Key` (参考 `moemail_api.json`)。
  - [ ] 如果不存在 `X-API-Key`，跳过此中间件 (交由JWT中间件处理)。
  - [ ] 如果存在 `X-API-Key`：
    - [ ] 提取Key。
    - [ ] **[安全]** 根据 `key_prefix` 快速查找 ApiKey 表。
    - [ ] **[安全]** 使用安全的哈希比对函数 (如 `bcrypt.compare` 或时序安全比较) 验证传入的Key和 `hashed_key`。
    - [ ] 如果匹配：查询关联的 User，并注入到 Hono 上下文 `c.set('user', ...)`。
    - [ ] 如果不匹配：立即返回 `401 Unauthorized`。

## M-API-007: 后端 - 公共API端点开发 (V1)

- [ ] 创建新的路由组 `/v1`
  - [ ] 在该路由组上应用 M-API-006 的 `apiKeyAuthMiddleware`。
- [ ] `POST /v1/emails/generate`: 创建临时邮箱。
  - [ ] 从 `c.get('user')` 获取已认证的用户。
  - [ ] 允许指定前缀或域名 (如果用户有权访问)。
  - [ ] 创建的邮箱与 `user_id` 关联。
- [ ] `GET /v1/emails/:emailAddress/messages`: 获取邮件列表。
  - [ ] **[安全]** 校验 `:emailAddress` 是否属于 `c.get('user')`。
  - [ ] **[优化]** 实现 `?page=1&limit=25` 分页。
  - [ ] 返回分页数据结构 `{ "data": [...], "pagination": { ... } }`。
- [ ] `GET /v1/emails/:emailAddress/messages/:messageId`: 获取单封邮件详情。
  - [ ] **[安全]** 校验 `:emailAddress` 的所有权。

## M-API-008: 单元测试与API文档

- [ ] 编写单元测试 (vitest)
  - [ ] 重点测试 M-API-006 认证中间件的各种情况 (成功、失败、无Key)。
  - [ ] 测试Key的哈希生成和比对逻辑。
- [ ] 编写集成测试
  - [ ] 模拟使用 `X-API-Key` 完整调用 M-API-007 的端点。
- [ ] 编写API文档
  - [ ] 创建 OpenAPI 3.0 规范 (YAML或JSON)，详细描述 `/v1` 路由组。