# M-API-006: 后端 - 核心：API-Key 认证中间件

## 🎯 目标
在 `mail-worker/src/security/security.js` 中创建一个新的中间件 `apiKeyAuthMiddleware`。此中间件用于验证 `X-API-Key` 请求头，并为 M-API-007 中的公共 API 路由提供用户上下文。

---

## 🗒️ 任务分解

### 1. (前置) 导入所需依赖

- [ ] **文件**: `mail-worker/src/security/security.js`
- [ ] **操作**: 在文件顶部添加 M-API-001 和 M-API-002 中创建的依赖。
- [ ] **详情**:
    ```javascript
    // ... (保留 Hono, jwt, Result 等原有导入)
    import { hashApiKey } from '../utils/crypto-utils'; // (M-API-002 创建的)
    import { ApiKey } from '../entity/api_key'; // (M-API-001 创建的)
    import User from '../entity/user'; //
    import { eq } from 'drizzle-orm';
    import { db } from '../hono/hono'; //
    ```

### 2. 创建 `apiKeyAuthMiddleware` 中间件

- [ ] **文件**: `mail-worker/src/security/security.js`
- [ ] **操作**: 在 `adminAuth` 函数之后，`export` 语句之前，添加新的 `apiKeyAuthMiddleware` 函数。
- [ ] **代码框架**:
    ```javascript
    /**
     * API Key 认证中间件
     */
    const apiKeyAuthMiddleware = async (c, next) => {
      // (在此处填充任务 3、4、5、6 的逻辑)
    };
    ```

### 3. 实现"旁路"逻辑 (处理浏览器请求)

- [ ] **文件**: `mail-worker/src/security/security.js`
- [ ] **操作**: 在 `apiKeyAuthMiddleware` 内部添加逻辑，检查 `X-API-Key` 头。
- [ ] **详情**:
    ```javascript
    const apiKeyAuthMiddleware = async (c, next) => {
      const key = c.req.header('X-API-Key'); //
    
      if (!key) {
        // [旁路逻辑]
        // 没有 API Key，假定这是普通的浏览器请求。
        // 不做任何事，直接进入下一个中间件 (即 `auth` 中间件)。
        await next();
        return;
      }
    
      // (如果 key 存在，则继续执行任务 4...)
    };
    ```

### 4. 实现"验证"逻辑 (处理 API 请求)

- [ ] **文件**: `mail-worker/src/security/security.js`
- [ ] **操作**: 紧跟任务 3 之后，添加 Key 验证和数据库查询逻辑。
- [ ] **详情**:
    ```javascript
      // ... (任务 3 的 if (!key) 块之后)

      // [验证逻辑]
      // 1. 哈希传入的 Key (使用 M-API-002 的函数)
      const hashedKey = await hashApiKey(key); //

      // 2. 查询数据库，同时 join User 表
      const [apiKeyWithUser] = await db(c).select()
        .from(ApiKey)
        .where(eq(ApiKey.hashed_key, hashedKey))
        .leftJoin(User, eq(ApiKey.user_id, User.userId));

      // 3. 处理无效 Key
      if (!apiKeyWithUser || !apiKeyWithUser.user) {
        return c.json(Result.error('Invalid API Key'), 401);
      }

      // 4. (继续执行任务 5...)
    ```
  *(**设计决策**: 我们使用 `leftJoin` 并检查 `apiKeyWithUser.user` 是否存在，这非常健壮)*

### 5. 实现"上下文注入" (验证成功)

- [ ] **文件**: `mail-worker/src/security/security.js`
- [ ] **操作**: 验证成功后，将用户注入 Hono 上下文，并更新 Key 的使用时间。
- [ ] **详情**:
    ```javascript
      // ... (任务 4 的 if 块之后)

      // 5. [注入上下文]
      const user = apiKeyWithUser.user;
      c.set('user', user); // <-- 核心步骤，与 user-context.js 行为一致

      // 6. [质量优化] 更新 Key 的 "最后使用时间" (异步，不阻塞)
      const updateLastUsed = async () => {
        try {
          await db(c).update(ApiKey)
            .set({ last_used_at: new Date() })
            .where(eq(ApiKey.id, apiKeyWithUser.api_key.id));
        } catch (e) {
          // 记录错误，但不影响主流程
          console.error('Failed to update API key last_used_at', e);
        }
      };
      c.executionCtx.waitUntil(updateLastUsed());

      // 7. 进入受保护的路由 (M-API-007)
      await next();
    ```

### 6. 导出中间件

- [ ] **文件**: `mail-worker/src/security/security.js`
- [ ] **操作**: 在底部的 `export` 语句中添加 `apiKeyAuthMiddleware`。
- [ ] **详情**:
    ```javascript
    export {
      auth,
      adminAuth,
      apiKeyAuthMiddleware // <-- 新增
    };
    ```

---

## ✅ 验收标准
- [ ] `security.js` 已成功创建并导出了 `apiKeyAuthMiddleware`。
- [ ] 不带 `X-API-Key` 的请求可以“旁路”此中间件，不会被拦截。
- [ ] 带**无效** `X-API-Key` 的请求被此中间件拦截，并返回 401 错误。
- [ ] 带**有效** `X-API-Key` 的请求成功通过，并且 `c.set('user', ...)` 被调用。
- [ ] (验收标准) 有效请求会触发 `last_used_at` 字段的更新。