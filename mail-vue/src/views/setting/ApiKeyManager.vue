<template>
  <div class="box">
    <div class="title">API Keys</div>
    <div class="container">
      <el-button type="primary" @click="handleGenerate">生成新的 API Key</el-button>
      <el-table v-loading="loading" :data="keyList" style="width: 100%; margin-top: 20px;">
        <el-table-column prop="description" label="描述" width="200"></el-table-column>
        <el-table-column prop="key_prefix" label="Key 前缀" width="150"></el-table-column>
        <el-table-column prop="scopes" label="权限范围" width="150">
          <template #default="scope">
            <span v-if="scope.row.scopes">
              {{ formatScopes(scope.row.scopes) }}
            </span>
            <span v-else style="color: #909399;">未设置</span>
          </template>
        </el-table-column>
        <el-table-column prop="expires_at" label="过期时间" width="180">
          <template #default="scope">
            {{ scope.row.expires_at ? dayjs(scope.row.expires_at).format('YYYY-MM-DD HH:mm:ss') : '永不' }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ dayjs(scope.row.created_at).format('YYYY-MM-DD HH:mm:ss') }}
          </template>
        </el-table-column>
        <el-table-column prop="last_used_at" label="最后使用" width="180">
          <template #default="scope">
            {{ scope.row.last_used_at ? dayjs(scope.row.last_used_at).format('YYYY-MM-DD HH:mm:ss') : '从未使用' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-popconfirm
              title="您确定要删除此 Key 吗？此操作不可撤销。"
              @confirm="handleDelete(scope.row)"
            >
              <template #reference>
                <el-button type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { getApiKeys, createApiKey, deleteApiKey } from '@/request/my.js'

const loading = ref(false)
const keyList = ref([])

const formatScopes = (scopesStr) => {
  try {
    const scopes = JSON.parse(scopesStr)
    const scopeNames = {
      'api:email-generate': '创建邮箱',
      'api:email-list': '查询邮件列表',
      'api:email-detail': '查询邮件详情'
    }
    return scopes.map(s => scopeNames[s] || s).join(', ')
  } catch (e) {
    return '解析错误'
  }
}

const loadKeys = async () => {
  loading.value = true
  try {
    const res = await getApiKeys()
    keyList.value = res.data
  } catch (error) {
    ElMessage.error('加载 API Key 列表失败')
  } finally {
    loading.value = false
  }
}

const handleGenerate = async () => {
  try {
    const { value: description } = await ElMessageBox.prompt('请输入 Key 描述', '生成 API Key', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '描述不能为空'
    })

    // 选择过期时间
    const expiresAt = await new Promise((resolve) => {
      ElMessageBox.confirm(
        '请选择 Key 的过期时间（可选）',
        '设置过期时间',
        {
          confirmButtonText: '设置过期时间',
          cancelButtonText: '永不过期',
          distinguishCancelAndClose: true,
          customClass: 'expires-dialog'
        }
      ).then(() => {
        // 用户选择设置过期时间
        const datePicker = document.createElement('input')
        datePicker.type = 'datetime-local'
        datePicker.min = new Date().toISOString().slice(0, 16)
        ElMessageBox({
          title: '选择过期时间',
          message: datePicker,
          showCancelButton: true,
          confirmButtonText: '确定',
          cancelButtonText: '取消'
        }).then(({ value }) => {
          if (value) {
            resolve(new Date(datePicker.value).getTime())
          } else {
            resolve(null)
          }
        }).catch(() => {
          resolve(null)
        })
      }).catch(() => {
        // 用户选择永不过期
        resolve(null)
      })
    })

    const data = { description }
    if (expiresAt) {
      data.expires_at = expiresAt
    }

    const res = await createApiKey(data)
    await ElMessageBox.alert(
      `这是您唯一一次看到此 Key，请立即复制并妥善保存。Key 泄露将危害您的账户安全。\n\nKey: ${res.data.fullKey}`,
      'API Key 已生成',
      {
        confirmButtonText: '我已复制',
        type: 'warning'
      }
    )
    loadKeys()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('生成 API Key 失败')
    }
  }
}

const handleDelete = async (row) => {
  try {
    await deleteApiKey(row.id)
    ElMessage.success('删除成功')
    loadKeys()
  } catch (error) {
    ElMessage.error('删除 API Key 失败')
  }
}

onMounted(() => {
  loadKeys()
})
</script>

<style scoped lang="scss">
.box {
  padding: 40px 40px;

  @media (max-width: 767px) {
    padding: 30px 30px;
  }

  .title {
    font-size: 18px;
    font-weight: bold;
  }

  .container {
    font-size: 14px;
    display: grid;
    gap: 20px;
    margin-bottom: 40px;
  }
}
</style>