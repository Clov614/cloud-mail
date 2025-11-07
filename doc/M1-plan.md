# M-API-001: 数据库模型设计与扩展

## 🎯 目标
为 `cloud-mail` 的后端数据库（Cloudflare D1）添加支持 API-Key 功能所需的数据表结构。这包括扩展现有的 `User` 表并创建全新的 `ApiKey` 表。

---

## 🗒️ 任务分解

### 1. 扩展 `User` 实体

- [ ] **文件**: `mail-worker/src/entity/user.js`
- [ ] **操作**: 修改 `User` 表定义。
- [ ] **详情**:
    - 在 `User` 表的 `defineTable` 中添加一个新字段：
      ```javascript
      can_create_api_keys: boolean('can_create_api_keys').default(false).notNull(),
      ```
    - **目的**: 此字段用于超管控制该用户是否**有权**创建和使用个人 API-Key。

### 2. 新建 `ApiKey` 实体

- [ ] **文件**: `mail-worker/src/entity/api_key.js` (新文件)
- [ ] **操作**: 创建一个新文件来定义 `ApiKey` 表。
- [ ] **详情**:
    - 参考 `mail-worker/src/entity/orm.js` 和 `user.js` 的格式，使用 `drizzle-orm` 定义新表。
    - **内容模板**:
      ```javascript
      import { text, sqliteTable, integer } from 'drizzle-orm/sqlite-core';
      import { User } from './user'; // 引入 User 以设置外键
      import { cuid } from '../utils/cuid'; // (需要确认是否已有 cuid 或使用 uuid)

      export const ApiKey = sqliteTable('api_key', {
        // 主键
        id: text('id').primaryKey().$defaultFn(() => cuid()), // 假设使用 cuid
        
        // 外键，关联到 User 表
        user_id: text('user_id').notNull().references(() => User.id, { onDelete: 'cascade' }),
        
        // 字段
        description: text('description').notNull(), // 用户自定义的Key描述
        key_prefix: text('key_prefix').notNull().unique(), // Key 的前缀，用于快速查找和前端展示
        hashed_key: text('hashed_key').notNull().unique(), // 经过哈希处理的完整 Key
        
        // 时间戳
        created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
        last_used_at: integer('last_used_at', { mode: 'timestamp_ms' }), // 可选，最后使用时间
      });
      ```

### 3. 更新 `orm.js` 导出

- [ ] **文件**: `mail-worker/src/entity/orm.js`
- [ ] **操作**: 导出新创建的 `ApiKey` 实体。
- [ ] **详情**:
    - 导入 `ApiKey`:
      ```javascript
      import { ApiKey } from './api_key';
      ```
    - 在 `export` 语句中添加 `ApiKey`:
      ```javascript
      export {
        // ... (保留原有导出)
        ApiKey,
      };
      ```

### 4. 生成并应用数据库迁移

- [ ] **操作**: 使用 `drizzle-kit` 生成 SQL 迁移文件。
- [ ] **命令** (在 `mail-worker` 目录下运行):
    ```bash
    pnpm drizzle-kit generate:sqlite
    ```
- [ ] **审查**:
    - [ ] 检查 `mail-worker/migrations` 目录下新生成的 `.sql` 文件。
    - [ ] 确认 SQL 语句符合预期（`ALTER TABLE user ADD COLUMN ...` 和 `CREATE TABLE api_key ...`）。
- [ ] **应用迁移** (本地开发):
    - [ ] 运行本地 Wrangler D1 命令来应用迁移：
      ```bash
      pnpm wrangler d1 migrations apply DB --local
      ```
  *(注意: `DB` 是您在 `wrangler.toml` 中定义的 D1 绑定的名称)*

---

## ✅ 验收标准
- [ ] `User` 表结构已更新。
- [ ] `ApiKey` 表已成功创建。
- [ ] 数据库迁移已在本地成功运行，没有错误。