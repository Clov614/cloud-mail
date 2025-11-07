<template>
  <div class="api-key-manager">
    <el-button type="primary" @click="handleGenerate">生成新的 API Key</el-button>
    <el-table v-loading="loading" :data="keyList" style="width: 100%; margin-top: 20px;">
      <el-table-column prop="description" label="描述" width="200"></el-table-column>
      <el-table-column prop="key_prefix" label="Key 前缀" width="150"></el-table-column>
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
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { getApiKeys, createApiKey, deleteApiKey } from '@/request/my.js'

const loading = ref(false)
const keyList = ref([])

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

    const res = await createApiKey({ description })
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

<style scoped>
.api-key-manager {
  padding: 20px;
}
</style>