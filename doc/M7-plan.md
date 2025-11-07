# M-API-007: 后端 - 公共 API 端点开发 (V1)

## 🎯 目标
创建一组新的 `/v1` API 端点，这些端点*仅*通过 `M-API-006` 的 `apiKeyAuthMiddleware` 进行认证。我们将实现创建邮箱、获取邮件列表（带分页）和获取邮件详情的功能。

---

## 🗒️ 任务分解

### 1. (关键) 修改 `mail-worker/src/index.js` 集成中间件

- [ ] **文件**: `mail-worker/src/index.js`
- [ ] **操作**: 导入 `apiKeyAuthMiddleware` 并将其应用到 `/api/*` 和新的 `/v1/*` 路由。
- [ ] **详情**:
    1.  **导入**: 在顶部 `import` 区域，从 `./security/security.js` 中额外导入 `apiKeyAuthMiddleware`。
    2.  **修改 `/api` 栈 (实现混合认证)**:
        在 `app.use('/api/*', auth)` **之前**插入 `apiKeyAuthMiddleware`。
        ```javascript
        // ...
        app.use('/api/*', userContext) //
        app.use('/api/*', apiKeyAuthMiddleware) // <-- [新增]
        app.use('/api/*', auth) //
        // ...
        ```
    3.  **添加 `/v1` 栈 (实现严格 API Key 认证)**:
        在 `/api` 栈之后，添加新的中间件栈。
        ```javascript
        // ...
        app.use('/v1/*', userContext) // <-- [新增]
        app.use('/v1/*', apiKeyAuthMiddleware) // <-- [新增]
        // ...
        ```
        *(注意：我们*不*为 `/v1` 添加 `auth`，因为 `/v1` 仅支持 API Key)*

### 2. 创建 `mail-worker/src/api/v1-api.js`

- [ ] **文件**: `mail-worker/src/api/v1-api.js` (新文件)
- [ ] **操作**: 创建 Hono 实例并添加一个前置中间件来强制认证。
- [ ] **详情**:
    ```javascript
    import { Hono } from 'hono';
    import result from '../model/result'; //
    import orm from '../entity/orm'; //
    import { eq, and, desc, count } from 'drizzle-orm';
    import Account from '../entity/account'; //
    import Email from '../entity/email'; //
    import accountService from '../service/account-service'; //
    
    const v1Api = new Hono();

    // [核心] 强制认证中间件
    v1Api.use('*', async (c, next) => {
      const user = c.get('user');
      if (!user) {
        // 如果 `apiKeyAuthMiddleware` 旁路了 (因为没有 Key)，
        // 我们在这里拦截它，并返回一个清晰的 API 错误。
        return c.json(result.fail('X-API-Key header is required or invalid'), 401);
      }
      // 如果 user 存在 (来自 M6)，则继续
      await next();
    });

    // (在此处填充任务 3, 4, 5 的路由)

    export default v1Api;
    ```

### 3. `POST /v1/emails/generate` (创建临时邮箱)

- [ ] **文件**: `mail-worker/src/api/v1-api.js`
- [ ] **操作**: 添加 `post` 路由，参考 `moemail_api.json`。
- [ ] **代码**:
    ```javascript
    v1Api.post('/emails/generate', async (c) => {
      const user = c.get('user'); // (已由中间件保证存在)
      const { name, domain } = await c.req.json();
      
      try {
        //
        const newAccount = await accountService.addAccount(c, name, domain, null, null, user.userId);
        return c.json(result.ok({ 
          id: newAccount.id, 
          address: newAccount.email 
        }));
      } catch (e) {
        return c.json(result.fail(e.message), 400);
      }
    });
    ```

### 4. `GET /v1/emails/:emailAddress/messages` (获取邮件列表)

- [ ] **文件**: `mail-worker/src/api/v1-api.js`
- [ ] **操作**: 添加 `get` 路由，实现“优雅”的分页。
- [ ] **代码**:
    ```javascript
    v1Api.get('/:emailAddress/messages', async (c) => {
      const user = c.get('user');
      const emailAddress = c.req.param('emailAddress');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '25');
      const offset = (page - 1) * limit;
      const db = orm(c);

      // [安全] 校验邮箱所有权
      const [account] = await db.select().from(Account)
        .where(and(eq(Account.email, emailAddress), eq(Account.userId, user.userId))).limit(1);
      if (!account) {
        return c.json(result.fail('Email address not found or access denied'), 404);
      }

      // [优化] 仅 select 列表所需的字段
      const [totalResult] = await db.select({ count: count() })
        .from(Email).where(eq(Email.address, emailAddress));
      
      const messages = await db.select({
          id: Email.id,
          from: Email.from,
          subject: Email.subject,
          date: Email.createTime //
        }).from(Email)
        .where(eq(Email.address, emailAddress))
        .orderBy(desc(Email.id))
        .limit(limit)
        .offset(offset);
      
      const totalItems = totalResult.count;
      const totalPages = Math.ceil(totalItems / limit);
      const pagination = { totalItems, totalPages, currentPage: page, limit };

      return c.json(result.ok({ data: messages, pagination }));
    });
    ```

### 5. `GET /v1/emails/:emailAddress/messages/:messageId` (获取邮件详情)

- [ ] **文件**: `mail-worker/src/api/v1-api.js`
- [ ] **操作**: 添加 `get` 路由，参考 `moemail_api.json`。
- [ ] **代码**:
    ```javascript
    v1Api.get('/:emailAddress/messages/:messageId', async (c) => {
      const user = c.get('user');
      const emailAddress = c.req.param('emailAddress');
      const messageId = c.req.param('messageId');
      const db = orm(c);

      // [安全] 校验邮箱所有权
      const [account] = await db.select().from(Account)
        .where(and(eq(Account.email, emailAddress), eq(Account.userId, user.userId))).limit(1);
      if (!account) {
        return c.json(result.fail('Email address not found or access denied'), 404);
      }

      // [优化] `messageId` 在 `Email` 表中是 `id`
      const [message] = await db.select().from(Email)
        .where(and(
          eq(Email.address, emailAddress),
          eq(Email.id, parseInt(messageId)) // (id 是 integer)
        )).limit(1);

      if (!message) {
        return c.json(result.fail('Message not found'), 404);
      }
      
      // 返回完整邮件对象
      return c.json(result.ok(message));
    });
    ```

### 6. 注册 `v1Api` 路由

- [ ] **文件**: `mail-worker/src/index.js`
- [ ] **操作**: 导入 `v1Api` 并在 `app.route` 区域注册它。
- [ ] **详情**:
    1.  **导入**: `import v1Api from './api/v1-api.js';`
    2.  **注册**: 在 `app.route('/api/test', testApi);` 之后添加一行：
        ```javascript
        app.route('/v1', v1Api); // <-- [新增]
        ```

---

## ✅ 验收标准
- [ ] `index.js` 已更新，正确应用了 `apiKeyAuthMiddleware` 到 `/api` 和 `/v1`。
- [ ] `v1-api.js` 已创建，并注册到 `index.js`。
- [ ] **[安全]** 调用 `/v1/` 路由 (如 `/v1/emails/generate`) **不带** `X-API-Key` 头，返回 401 "X-API-Key header is required" 错误。
- [ ] **[安全]** 调用 `/v1/` 路由 (如 `/v1/emails/generate`) **带无效** `X-API-Key` 头，返回 401 "Invalid API Key" 错误。
- [ ] `POST /v1/emails/generate` (带有效Key) 成功创建邮箱并返回地址。
- [ ] `GET /v1/.../messages` (带有效Key) 成功返回分页的邮件列表，且**只能**访问自己的邮箱。
- [ ] `GET /v1/.../messages/:id` (带有效Key) 成功返回邮件详情，且**只能**访问自己的邮件。