# M-API-002: 后端 - API-Key 管理逻辑 (内部接口)

## 🎯 目标
开发 Hono 后端路由，允许*已登录*用户（通过JWT Token认证）创建、查看和删除他们自己的 API-Key。所有这些新路由都将添加到 `mail-worker/src/api/my-api.js` 文件中。

---

## 🗒️ 任务分解

### 1. (前置) 创建加密工具函数

- [ ] **文件**: `mail-worker/src/utils/crypto-utils.js`
- [ ] **操作**: 添加两个新的 `export` 函数，用于生成和哈希API Key。
- [ ] **函数 1: `generateApiKey()`** (生成Key)
    - **逻辑**:
        1.  `const secret = crypto.randomUUID().replaceAll('-', '');` (生成 32 位随机字符串)
        2.  `const fullKey = 'cm_sk_' + secret;` (完整的Key，例如: `cm_sk_a1b2c3d4...`)
        3.  `const prefix = 'cm_...' + secret.substring(secret.length - 4);` (Key前缀，例如: `cm_...ff34`)
        4.  `return { fullKey, prefix };`
- [ ] **函数 2: `hashApiKey(key)`** (哈希Key)
    - **逻辑**:
        1.  使用 Web Crypto API (`crypto.subtle.digest`) 计算 `SHA-256` 哈希。
        2.  `const encoder = new TextEncoder();`
        3.  `const data = encoder.encode(key);`
        4.  `const hashBuffer = await crypto.subtle.digest('SHA-256', data);`
        5.  将 `hashBuffer` 转换为十六进制字符串 (hex string) 并返回。
            *(这将是我们的 `hashed_key`)*

### 2. `GET /api/my/api-keys` (获取列表)

- [ ] **文件**: `mail-worker/src/api/my-api.js`
- [ ] **操作**: 在 `myApi` (Hono 实例) 上添加 `get` 路由。
- [ ] **逻辑**:
    1.  从上下文 `c.get('user')` 获取当前登录的用户。
    2.  使用 Drizzle 查询 `ApiKey` 表，`where(eq(ApiKey.user_id, user.userId))`。
    3.  **[安全]** 使用 `.select()` **仅返回**非敏感字段：`id`, `description`, `key_prefix`, `created_at`, `last_used_at`。
    4.  **[安全]** **绝不**返回 `hashed_key` 字段。
    5.  返回 `Result.ok(data)`。

### 3. `POST /api/my/api-keys` (创建Key)

- [ ] **文件**: `mail-worker/src/api/my-api.js`
- [ ] **操作**: 在 `myApi` 上添加 `post` 路由。
- [ ] **逻辑**:
    1.  从 `c.get('user')` 获取用户。
    2.  **[权限]** 检查 `user.can_create_api_keys === 1`。如果为 `0` (false)，返回 `Result.error('您没有创建API-Key的权限')`。
    3.  从请求体 (JSON) 中获取 `description`。
    4.  调用任务 1 中的 `generateApiKey()`，获取 `{ fullKey, prefix }`。
    5.  调用任务 1 中的 `hashApiKey(fullKey)`，获取 `hashedKey`。
    6.  使用 Drizzle 将以下数据插入 `ApiKey` 表：
        - `user_id`: `user.userId`
        - `description`: (来自请求体)
        - `key_prefix`: `prefix`
        - `hashed_key`: `hashedKey`
    7.  **[安全]** **仅在本次响应中**，将 `fullKey` (明文Key) 返回给前端。响应数据应包含 `{ id, description, key_prefix, fullKey }`。

### 4. `DELETE /api/my/api-keys/:keyId` (删除Key)

- [ ] **文件**: `mail-worker/src/api/my-api.js`
- [ ] **操作**: 在 `myApi` 上添加 `delete` 路由。
- [ ] **逻辑**:
    1.  从 `c.get('user')` 获取用户。
    2.  从路径参数 `c.req.param('keyId')` 获取 `keyId`。
    3.  执行 Drizzle `delete` 操作。
    4.  **[安全]** `where` 条件必须同时包含 `eq(ApiKey.id, keyId)` 和 `eq(ApiKey.user_id, user.userId)`。
        *(这确保了用户*只能*删除自己的 Key)*
    5.  返回 `Result.ok('删除成功')`。

---

## ✅ 验收标准
- [ ] `crypto-utils.js` 已添加并导出了两个新函数。
- [ ] `GET /api/my/api-keys` 成功返回当前用户的Key列表 (不含哈希)。
- [ ] `POST /api/my/api-keys` 成功创建Key，数据库中存储的是哈希，并**仅返回一次**明文Key。
- [ ] `POST /api/my/api-keys` 对 `can_create_api_keys === 0` 的用户返回 403 错误。
- [ ] `DELETE /api/my/api-keys/:keyId` 只能删除自己的Key。