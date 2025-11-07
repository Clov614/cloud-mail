# M-API-008: 单元测试与 API 文档

## 🎯 目标
通过编写单元测试（Unit Tests）来保证核心安全逻辑 (M-API-006) 的代码质量，并创建一份 OpenAPI 3.0 规范（如 `moemail_api.json`）来为新的 `/v1` 路由 (M-API-007) 提供高质量的开发者文档。

---

## 🗒️ 任务分解

### 1. 编写单元测试 (M-API-006)

- [ ] **文件**: `mail-worker/test/security.spec.js` (新文件或修改 `index.spec.js`)
- [ ] **框架**: `vitest` (根据 `vitest.config.js`)
- [ ] **操作**: 重点测试 `apiKeyAuthMiddleware` 的逻辑分支。
- [ ] **测试用例 1: "应旁路没有 X-API-Key 的请求"**
    - **模拟**: Hono `Context` (c) 不带 `X-API-Key` 头。
    - **断言**: `await next()` 被调用1次，`c.set('user', ...)` 未被调用。
- [ ] **测试用例 2: "应拒绝无效的 X-API-Key"**
    - **模拟**: `Context` 带有无效的 `X-API-Key`。（需要 Mock Drizzle `db.select()...` 返回空数组）。
    - **断言**: `await next()` 未被调用，`c.json()` 被调用，且状态码为 401。
- [ ] **测试用例 3: "应接受有效的 X-API-Key 并注入用户"**
    - **模拟**: `Context` 带有有效的 `X-API-Key`。（需要 Mock Drizzle `db.select()...` 返回一个 `apiKeyWithUser` 对象）。
    - **断言**: `c.set('user', ...)` 被调用，`await next()` 被调用1次。

### 2. (可选) 编写 `crypto-utils` 单元测试

- [ ] **文件**: `mail-worker/test/crypto.spec.js` (新文件)
- [ ] **操作**: 测试 M-API-002 中创建的加密工具。
- [ ] **测试用例 1: `generateApiKey()`**
    - **断言**: `fullKey` 以 `cm_sk_` 开头，`prefix` 以 `cm_...` 开头且长度正确。
- [ ] **测试用例 2: `hashApiKey()`**
    - **断言**: 相同的输入两次，应产生相同的 `SHA-256` 哈希输出。

### 3. 创建 OpenAPI 3.0 文档

- [ ] **文件**: `mail-worker/doc/openapi.json` (新文件)
- [ ] **操作**: 模仿 `moemail_api.json` 的结构，为我们的 `/v1` 路由 编写 API 文档。
- [ ] **[Security]**:
    - [ ] 在 `components.securitySchemes` 中定义 `ApiKeyAuth`，`type: apiKey`, `in: header`, `name: X-API-Key`。
    - [ ] 在顶层 `security` 中应用它。
- [ ] **[Paths] `POST /v1/emails/generate`**
    - [ ] **Summary**: "创建临时邮箱"。
    - [ ] **Request Body**: `application/json`，包含 `name` (string, optional) 和 `domain` (string, optional)。
    - [ ] **Response (200 OK)**: `application/json`，返回 `{ id: string, address: string }`（参考 `result.ok`）。
- [ ] **[Paths] `GET /v1/{emailAddress}/messages`**
    - [ ] **Summary**: "获取邮件列表 (分页)"。
    - [ ] **Parameters**:
        - `emailAddress` (path, required)
        - `page` (query, optional, default: 1)
        - `limit` (query, optional, default: 25)
    - [ ] **Response (200 OK)**: `application/json`，返回 `{ data: [...messages], pagination: { totalItems, totalPages, currentPage } }`。
- [ ] **[Paths] `GET /v1/{emailAddress}/messages/{messageId}`**
    - [ ] **Summary**: "获取单封邮件详情"。
    - [ ] **Parameters**:
        - `emailAddress` (path, required)
        - `messageId` (path, required)
    - [ ] **Response (200 OK)**: `application/json`，返回完整的 `Email` 对象（参考 `result.ok(message)`）。

---

## ✅ 验收标准
- [ ] `vitest` 单元测试已编写并通过，覆盖 `apiKeyAuthMiddleware` 的关键逻辑。
- [ ] `openapi.json` 文件已创建，并完整描述了 `/v1` 路由的所有端点、参数和响应。
- [ ] (最终) 整个 "Cloud-Mail 个人 API 系统" 功能开发完成。