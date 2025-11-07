# M-API-005: 前端 - 超管权限管理界面

## 🎯 目标
在 `mail-vue` 前端项目的“用户管理”页面，为管理员添加一个 UI 控件（开关），以启用或禁用特定用户的 API-Key 创建权限。

---

## 🗒️ 任务分解

### 1. (前置) 添加前端 API 请求

- [ ] **文件**: `mail-vue/src/request/user.js`
- [ ] **操作**: 添加一个新的 API 请求函数，对应 `M-API-003` 中创建的后端接口。
- [ ] **新增函数**:
    ```javascript
    // 更新用户的 API 权限
    export const updateUserApiPermission = (userId, status) => {
      // status 应该是 0 或 1
      const data = {
        can_create_api_keys: status 
      };
      return request({
        url: `/api/users/${userId}/api-permission`,
        method: 'put',
        data
      })
    }
    ```

### 2. (前置) 确保用户列表数据包含权限

- [ ] **文件**: `mail-vue/src/views/user/index.vue`
- [ ] **操作**: 确认 `loadData` 方法获取的用户列表中包含了 `can_create_api_keys` 字段。
- [ ] **详情**:
    - `M-API-001` 中我们已在后端 `User` 表 添加了此字段。
    - 后端的 `/api/users` (获取用户列表) 接口需要确保返回了此字段。
    - 前端 `loadData` 拿到的 `tableData` 中的每一行 (row) 都应该有 `row.can_create_api_keys`。

### 3. 修改 `el-table` 添加新列

- [ ] **文件**: `mail-vue/src/views/user/index.vue`
- [ ] **操作**: 在 `<template>` 中的 `<el-table>` 里，添加一个新列 "允许API访问"。
- [ ] **位置**: 建议放在 "状态" 和 "操作" 列之间。
- [ ] **代码**:
    ```html
    <el-table-column :label="$t('user.apiPermission')" align="center" width="120">
      <template #default="scope">
        <el-switch
          v-model="scope.row.can_create_api_keys"
          :active-value="1"
          :inactive-value="0"
          @change="handleApiPermissionChange(scope.row)"
          :disabled="scope.row.type === 0" 
        />
        </template>
    </el-table-column>
    ```

### 4. 实现权限变更 `handle` 方法

- [ ] **文件**: `mail-vue/src/views/user/index.vue`
- [ ] **操作**: 在 `<script setup>` 中添加 `handleApiPermissionChange` 方法。
- [ ] **新增函数**:
    ```javascript
    // (需要先导入 updateUserApiPermission 和 ElMessage)
    import { updateUserApiPermission } from '@/request/user.js' //
    import { ElMessage } from 'element-plus'

    // ...
    
    const handleApiPermissionChange = async (row) => {
      try {
        const newStatus = row.can_create_api_keys; // (此时 v-model 已经更新了 row 上的值)
        await updateUserApiPermission(row.userId, newStatus);
        ElMessage.success('权限更新成功');
      } catch (error) {
        ElMessage.error('权限更新失败');
        // 出错时将开关恢复原状
        row.can_create_api_keys = row.can_create_api_keys === 1 ? 0 : 1; 
      }
    }
    ```

### 5. (可选) 添加国际化(i18n)

- [ ] **文件**: `mail-vue/src/i18n/zh.js` 和 `en.js`
- [ ] **操作**: 为任务 3 中使用的 `$t('user.apiPermission')` 添加翻译。
- [ ] **`zh.js`**: `user: { ... apiPermission: 'API权限' }`
- [ ] **`en.js`**: `user: { ... apiPermission: 'API Permission' }`

---

## ✅ 验收标准
- [ ] `user.js` 已包含 `updateUserApiPermission` 函数。
- [ ] 管理员登录后，"用户管理" 页面的表格中显示 "API权限" 列。
- [ ] `el-switch` 开关能正确反映并修改用户的 `can_create_api_keys` 状态。
- [ ] 修改开关状态时，会调用 `M-API-003` 的后端接口并给出成功/失败提示。