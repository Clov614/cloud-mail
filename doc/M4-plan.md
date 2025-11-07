# M-API-004: 前端 - 用户API-Key管理界面

## 🎯 目标
在 `mail-vue` 前端项目中，为已登录用户提供一个管理 API-Key 的完整 UI。这包括基于权限显示菜单、列出 Key、创建 Key（并安全地显示）以及删除 Key。

---

## 🗒️ 任务分解

### 1. (前置) 在 `store` 中访问权限

- [ ] **文件**: `mail-vue/src/store/user.js`
- [ ] **操作**: 确认 `userInfo` state (或 getter) 中包含了 `can_create_api_keys` 字段。
- [ ] **详情**:
    - `M-API-001` 中我们已经在后端 `User` 表 添加了此字段。
    - 登录和获取用户信息的接口 (`/api/my/info`) 应已将其返回。
    - 确保 `store` 中正确存储了这个值（`0` 或 `1`）。

### 2. (前置) 添加前端 API 请求

- [ ] **文件**: `mail-vue/src/request/my.js`
- [ ] **操作**: 添加三个新的 API 请求函数，对应 `M-API-002` 中创建的后端接口。
- [ ] **新增函数**:
    ```javascript
    // 获取 API Key 列表
    export const getApiKeys = () => {
      return request({
        url: '/api/my/api-keys',
        method: 'get'
      })
    }
    
    // 创建 API Key
    export const createApiKey = (data) => {
      // data: { description: '...' }
      return request({
        url: '/api/my/api-keys',
        method: 'post',
        data
      })
    }
    
    // 删除 API Key
    export const deleteApiKey = (keyId) => {
      return request({
        url: `/api/my/api-keys/${keyId}`,
        method: 'delete'
      })
    }
    ```

### 3. 创建 `ApiKeyManager` UI 组件

- [ ] **文件**: `mail-vue/src/views/setting/ApiKeyManager.vue` (新文件)
- [ ] **操作**: 创建一个新的 Vue 组件来封装所有 API-Key 管理逻辑。
- [ ] **逻辑**:
    1.  **State**:
        - `loading = ref(false)`
        - `keyList = ref([])`
    2.  **`onMounted`**:
        - 调用 `loadKeys()` 方法。
    3.  **方法: `loadKeys()`**:
        - `loading.value = true`
        - 调用 `getApiKeys()`。
        - 成功后：`keyList.value = res.data`。
        - 最终：`loading.value = false`。
    4.  **方法: `handleGenerate()`**:
        - （见任务 3.2）
    5.  **方法: `handleDelete(row)`**:
        - （见任务 3.3）
- [ ] **UI (Template)**:
    - [ ] `el-button` (类型 "primary") "生成新的 API Key" @click=`handleGenerate`。
    - [ ] `el-table` `v-loading="loading"` 绑定 `keyList` 数据。
    - [ ] **Table 列**:
        - `description` (描述)
        - `key_prefix` (Key 前缀)
        - `created_at` (创建时间, 使用 `day.js` 格式化)
        - `last_used_at` (最后使用, 格式化)
        - `操作` (包含删除按钮)

### 4. `ApiKeyManager` 任务 3.2: 实现"生成"逻辑

- [ ] **操作**: 完善 `handleGenerate()` 方法。
- [ ] **逻辑**:
    1.  使用 `ElMessageBox.prompt` 弹窗，要求用户输入 "Key 描述" (description)。
    2.  用户确认后，调用 `createApiKey({ description: promptValue })`。
    3.  **[安全]** 成功后，使用 `ElMessageBox.alert` (或 `ElDialog`) 显示**完整 Key** (`res.data.fullKey`)。
    4.  **[安全]** 弹窗内容必须包含**醒目警告**："这是您唯一一次看到此 Key，请立即复制并妥善保存。Key 泄露将危害您的账户安全。"
    5.  弹窗关闭后，调用 `loadKeys()` 刷新列表。

### 5. `ApiKeyManager` 任务 3.3: 实现"删除"逻辑

- [ ] **操作**: 完善 `handleDelete(row)` 方法。
- [ ] **UI**: 在 `el-table` 的操作列中添加 `el-popconfirm` (气泡确认框) 或 `el-button` (类型 "danger")。
- [ ] **逻辑**:
    1.  触发 `handleDelete(row)`。
    2.  使用 `ElMessageBox.confirm` 弹窗（“您确定要删除此 Key 吗？此操作不可撤销。”）。
    3.  用户确认后，调用 `deleteApiKey(row.id)`。
    4.  成功后，`ElMessage.success('删除成功')`。
    5.  调用 `loadKeys()` 刷新列表。

### 6. 集成到"设置"页面

- [ ] **文件**: `mail-vue/src/views/setting/index.vue`
- [ ] **操作**: 将新组件集成到 `el-tabs` 中。
- [ ] **逻辑**:
    1.  在 `<script setup>` 中导入 `ApiKeyManager` 组件。
    2.  从 `userStore` (Pinia) 中获取 `userInfo`。
    3.  在 `<el-tabs>` 内部，添加一个新的 `<el-tab-pane>`:
        ```vue
        <el-tab-pane 
          v-if="userInfo.can_create_api_keys === 1" 
          label="API 管理" 
          name="apiKey"
        >
          <ApiKeyManager />
        </el-tab-pane>
        ```
    - **[权限]** `v-if` 指令至关重要，它确保只有 `can_create_api_keys === 1` 的用户才能看到此选项卡。

---

## ✅ 验收标准
- [ ] `my.js` 已包含三个新的 API 函数。
- [ ] `can_create_api_keys === 0` 的用户登录后，在"设置" 页面看不到 "API 管理" 选项卡。
- [ ] `can_create_api_keys === 1` 的用户登录后，可以看到 "API 管理" 选项卡。
- [ ] "API 管理" 选项卡能正确加载并显示 Key 列表 (`el-table`)。
- [ ] "生成 Key" 按钮能弹出输入框，成功创建 Key，并**安全地**在弹窗中显示一次明文 Key。
- [ ] "删除" 按钮能弹出确认框，并成功删除 Key，同时刷新列表。