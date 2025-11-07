您描述的这个需求非常经典，它引入了两个在 M1-M8 计划中确实缺失的核心概念：

- **Key 的时效性（Expiration）**：用户可以控制 Key 的有效期。
- **Key 的权限范围（Scopes）**：通过权限（Scopes）来区分"个人用户Key"和"超管Key"的能力。

您说 M1-M8 已经开发完毕，这非常好。但要实现您的新需求，我们需要对 M1-M8 中的几乎每一个模块进行一次"增量重构（Incremental Refactoring）"，以无缝地织入"时效性"和"Scopes"这两个概念。

这是一个高质量、无错误的增补计划，从 M-API-009 开始，并明确指出了需要重构的旧模块。

# Cloud-Mail API 增补计划 (Phase 2)

## M-API-009: 数据库模型重构 (Refactor M-API-001)

**目标**: 修改 ApiKey 和 User 实体，以支持"过期时间"和"权限范围(Scopes)"。

- [ ] 重构 ApiKey 实体 (`mail-worker/src/entity/api_key.js`)
  - [ ] 增加可空字段 expires_at (时间戳, integer('expires_at', { mode: 'timestamp_ms' }))。
  - [ ] 增加非空字段 scopes (字符串, text('scopes').notNull())。
  - **设计决策**: 我们将使用此字段存储 JSON 数组字符串，例如 ["email:read", "email:create"]。
- [ ] 重构 User 实体 (`mail-worker/src/entity/user.js`)
  - [ ] 增加可空字段 max_api_scopes (字符串, text('max_api_scopes'))。
  - **设计决策**: 超管将通过此字段（存储JSON数组）来定义该用户有权生成的 Key 的最大权限范围。如果为 null，则该用户（即使 can_create_api_keys=true）也只能生成最基础的个人权限Key。
- [ ] 更新 ORM/D1 迁移脚本
- [ ] 运行 drizzle-kit 生成新的迁移文件并应用到数据库。

## M-API-010: 后端 - API-Key 管理逻辑重构 (Refactor M-API-002)

**目标**: 重构 Key 的"创建"和"获取"逻辑，使其支持 expires_at 和 scopes。

- [ ] 重构 POST /api/my/api-keys (创建Key) (`mail-worker/src/api/my-api.js`)
  - [ ] **[输入]** 允许 c.req.json() 接收可选的 expires_at (时间戳)。
  - [ ] **[权限]** 从 c.get('user') 中获取 max_api_scopes。
  - [ ] **[逻辑]**
    - 如果 user.max_api_scopes 不为空 (由超管设定)，则新 Key 的 scopes 字段 = user.max_api_scopes。
    - 如果 user.max_api_scopes 为空（即标准个人用户），则新 Key 的 scopes 字段 = ['email:self'] (一个代表"仅限自身资源"的默认权限)。
  - [ ] **[数据库]** 存入 ApiKey 表时，必须同时存入 expires_at (可为 null) 和计算出的 scopes (JSON 字符串)。
  - [ ] **[响应]** 返回给前端的数据中，现在也必须包含 expires_at 和 scopes。
- [ ] 重构 GET /api/my/api-keys (获取Key列表) (`mail-worker/src/api/my-api.js`)
  - [ ] **[响应]** 从数据库查询时，增加 expires_at 和 scopes 字段，并返回给前端。

## M-API-011: 后端 - 核心认证中间件重构 (Refactor M-API-006)

**目标**: 在 apiKeyAuthMiddleware 中增加"过期检查"和"Scope 注入"。

- [ ] 重构 apiKeyAuthMiddleware (`mail-worker/src/security/security.js`)
  - [ ] **[时效性检查]**
    - 在 M-API-006 步骤 4（哈希比对）成功后，获取到 apiKeyWithUser.api_key 对象。
    - 立即检查 apiKeyWithUser.api_key.expires_at。
    - 如果 expires_at 存在 且 new Date() > new Date(apiKeyWithUser.api_key.expires_at)，则必须立即返回 401 Unauthorized 并附带 Result.error('API-Key 已过期')。
  - [ ] **[Scope 注入]**
    - 解析 apiKeyWithUser.api_key.scopes (JSON 字符串) 为一个数组（例如 scopesArray）。
    - 在 M-API-006 步骤 5（上下文注入）中，除了 c.set('user', ...)，还必须注入 Scopes：

      ```javascript
      c.set('user', user);
      c.set('api_scopes', scopesArray); // <-- [新增] 注入权限范围
      ```

## M-API-012: 后端 - 权限(Scope)校验中间件 (New Module)

**目标**: 创建一个新的中间件，用于验证已被 apiKeyAuthMiddleware 注入的 api_scopes。

- [ ] 新建 scopeAuthMiddleware (`mail-worker/src/security/security.js`)
- [ ] 创建一个中间件工厂函数 checkScope(requiredScope)。
- [ ] **逻辑**:
  - checkScope (例如 checkScope('email:self')) 返回一个 Hono 中间件。
  - 该中间件从上下文 c.get('api_scopes') 获取权限数组。
  - 如果 api_scopes 数组包含 requiredScope (或包含代表超管的 'admin')，则调用 await next()。
  - 如果 api_scopes 不存在或不包含 requiredScope，则立即返回 403 Forbidden 并附带 Result.error('权限不足 (Insufficient Scope)')。
- [ ] 在 security.js 底部导出 checkScope。

## M-API-013: 后端 - 公共 API 端点应用 Scope (Refactor M-API-007)

**目标**: 在 /v1 路由上应用 M-API-012 的权限校验，确保Key只能做被授权的事。

- [ ] 重构 /v1 路由 (`mail-worker/src/api/v1-api.js` 或 M-API-007 中的路由)
- [ ] 导入 checkScope 中间件 (../security/security.js)。
- [ ] 重构 POST /v1/emails/generate:
  - [ ] 在路由上应用 checkScope('email:self') (或您为超管定义的 email:admin:create 等)。
  - [ ] (可选) 移除 M-API-007 中关于 user_id 的手动校验，因为 checkScope 已经隐含了这一点（如果设计合理）。
- [ ] 重构 GET /v1/emails/:emailAddress/messages:
  - [ ] 应用 checkScope('email:self')。
  - [ ] 必须保留 M-API-007 中的资源所有权校验（[安全] 校验 :emailAddress 是否属于 c.get('user')），这是至关重要的。
- [ ] 重构 GET /v1/emails/:emailAddress/messages/:messageId:
  - [ ] 应用 checkScope('email:self') 并保留资源所有权校验。

## M-API-014: 前端 - 用户 Key 管理界面重构 (Refactor M-API-004)

**目标**: 在前端 ApiKeyManager 组件中支持"过期时间"的选择和显示。

- [ ] 重构 ApiKeyManager 组件 (`mail-vue/src/views/setting/ApiKeyManager.vue` 或 M-API-004 创建的组件)
  - [ ] **[显示]** 在 el-table 中：
    - [ ] 增加新的一列 "Scopes"，显示 row.scopes (例如 ['email:self'])。
    - [ ] 增加新的一列 "过期时间"，格式化显示 row.expires_at (如果为 null，显示 "永不")。
  - [ ] **[创建]** 在 "生成新Key" 的弹窗中：
    - [ ] 增加一个 el-date-picker (日期时间选择器)，允许用户选择一个未来的 expires_at 日期。
    - [ ] 允许用户不选择（即 null，代表永不过期）。
    - [ ] 在调用 POST /api/my/api-keys 接口时，将 expires_at (时间戳或 null) 作为参数传递。

## M-API-015: 前端 - 超管权限管理重构 (Refactor M-API-005)

**目标**: 在超管的"用户管理"界面，增加对用户 max_api_scopes 的控制（即您提到的"小条目"）。

- [ ] (前置) 后端 - 新增超管接口 (Refactor M-API-003)
  - [ ] 文件: `mail-worker/src/api/user-api.js`
  - [ ] 路由: PUT /api/users/:userId/api-scopes (受 adminAuth 保护)。
  - [ ] 逻辑: 接收 { scopes: ['email:self', 'admin:read'] } 或 { scopes: null }，并更新 User 表中的 max_api_scopes 字段。
- [ ] (前置) 前端 - 新增请求 (`mail-vue/src/request/user.js`)
  - [ ] 添加 updateUserApiScopes(userId, scopes) 函数，调用上述新接口。
- [ ] (核心) 前端 - 修改用户管理界面 (`mail-vue/src/views/user/index.vue`)
  - [ ] 在 el-table 中，can_create_api_keys 开关的旁边或下方，增加一个 "配置权限" 按钮。
  - [ ] 此按钮仅在 row.can_create_api_keys === 1 时启用。
  - [ ] 点击按钮，弹出一个新 Dialog (模态框)。
  - [ ] 模态框中包含一组 el-checkbox-group (复选框)，列出所有可用的 Scopes (例如: 'email:self', 'admin:read', 'admin:write')。
  - [ ] **[逻辑]**
    - 加载模态框时，调用 GET /api/users/:userId/info (或确保 loadData 已加载 row.max_api_scopes) 来回显当前勾选状态。
    - 用户点击 "保存" 时，调用 updateUserApiScopes(userId, selectedScopes)。

这个增补计划从数据库到前后端，完整地实现了您关于"过期时间"和"两级(个人/超管)权限模型"的核心需求。