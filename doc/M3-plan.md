# M-API-003: 后端 - 超管权限控制 (内部接口)

## 🎯 目标
开发一个 Hono 后端路由，允许**管理员**（超管）修改**任意用户**的 `can_create_api_keys` 状态。此接口将用于前端的用户管理面板。

---

## 🗒️ 任务分解

### 1. (前置) 确认管理员认证中间件

- [ ] **文件**: `mail-worker/src/api/user-api.js`
- [ ] **操作**: 检查 `userApi` (Hono 实例) 是如何应用管理员权限的。
- [ ] **详情**:
    - 浏览 `user-api.js` 文件，确认它是否使用了 `adminAuth` 中间件（或类似的中间件）。
    - 我们的新路由将**必须**应用相同的管理员权限检查，以确保只有管理员才能调用。

### 2. `PUT /api/users/:userId/api-permission` (更新权限)

- [ ] **文件**: `mail-worker/src/api/user-api.js`
- [ ] **操作**: 在 `userApi` 上添加一个新的 `put` 路由。
- [ ] **路由**: `userApi.put('/:userId/api-permission', ...)
- [ ] **逻辑**:
    1.  （此路由已受 `adminAuth` 保护）
    2.  从路径参数 `c.req.param('userId')` 获取 `userId`。
    3.  从请求体 `await c.req.json()` 中解析出 `{ can_create_api_keys }`。
    4.  **[校验]** 检查 `can_create_api_keys` 是否为 `0` 或 `1`。如果不是，返回 `Result.error('无效的状态值')`。
    5.  使用 Drizzle `update` 命令更新 `User` 表：
        ```javascript
        await db(c).update(User)
          .set({ can_create_api_keys: newStatus }) // newStatus 必须是 0 或 1
          .where(eq(User.userId, userId));
        ```
    6.  **[校验]** (可选但推荐) 检查 `update` 操作的 `rowsAffected`。如果为 0，可能意味着 `userId` 不存在，可以返回一个特定的错误。
    7.  返回 `Result.ok('权限更新成功')`。

### 3. (前置) 导出 Drizzle 依赖

- [ ] **文件**: `mail-worker/src/api/user-api.js`
- [ ] **操作**: 确保 `user-api.js` 导入了 Drizzle 所需的 `eq` 和 `User` 实体。
- [ ] **详情**:
    - 确保文件顶部包含：
      ```javascript
      import { eq } from 'drizzle-orm';
      import User from '../entity/user'; //
      import { db } from '../hono/hono'; // (或项目用于获取 db 实例的正确方式)
      ```

---

## ✅ 验收标准
- [ ] 新的 `PUT /api/users/:userId/api-permission` 路由已创建。
- [ ] 该路由受到管理员权限 (Admin Auth) 的严格保护。
- [ ] 调用该路由（例如使用 `{"can_create_api_keys": 1}`）能成功修改数据库中对应 `userId` 的 `can_create_api_keys` 字段。
- [ ] 非管理员调用此接口会返回 403 Forbidden 错误。