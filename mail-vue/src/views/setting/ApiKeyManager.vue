<template>
  <div class="box">
    <div class="title">{{ $t('apiKeys') }}</div>
    <div class="container">
      <el-button type="primary" @click="handleGenerate">{{ $t('generateApiKey') }}</el-button>
      <el-table v-loading="loading" :data="keyList" style="width: 100%; margin-top: 20px;">
        <el-table-column prop="description" :label="$t('apiKeyDescription')" width="200"></el-table-column>
        <el-table-column prop="key_prefix" :label="$t('keyPrefix')" width="150"></el-table-column>
        <el-table-column prop="scopes" :label="$t('permissionScope')" width="150">
          <template #default="scope">
            <span v-if="scope.row.scopes">
              {{ formatScopes(scope.row.scopes) }}
            </span>
            <span v-else style="color: #909399;">{{ $t('notSet') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="expires_at" :label="$t('expiresAt')" width="180">
          <template #default="scope">
            {{ scope.row.expires_at ? dayjs(scope.row.expires_at).format('YYYY-MM-DD HH:mm:ss') : $t('neverExpires') }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="$t('createdAt')" width="180">
          <template #default="scope">
            {{ dayjs(scope.row.created_at).format('YYYY-MM-DD HH:mm:ss') }}
          </template>
        </el-table-column>
        <el-table-column prop="last_used_at" :label="$t('lastUsedAt')" width="180">
          <template #default="scope">
            {{ scope.row.last_used_at ? dayjs(scope.row.last_used_at).format('YYYY-MM-DD HH:mm:ss') : $t('neverUsed') }}
          </template>
        </el-table-column>
        <el-table-column :label="$t('action')" width="100">
          <template #default="scope">
            <el-popconfirm
              :title="$t('deleteApiKeyConfirm')"
              @confirm="handleDelete(scope.row)"
            >
              <template #reference>
                <el-button type="danger" size="small">{{ $t('deleteApiKey') }}</el-button>
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
import { useI18n } from 'vue-i18n'
import { getApiKeys, createApiKey, deleteApiKey } from '@/request/my.js'

const { t } = useI18n()

const loading = ref(false)
const keyList = ref([])

const formatScopes = (scopesData) => {
  try {
    // 处理可能是字符串或数组的情况
    const scopes = typeof scopesData === 'string' ? JSON.parse(scopesData) : scopesData
    const scopeNames = {
      'api:email-generate': t('scopeEmailGenerate'),
      'api:email-list': t('scopeEmailList'),
      'api:email-detail': t('scopeEmailDetail')
    }
    return scopes.map(s => scopeNames[s] || s).join(', ')
  } catch (e) {
    return t('parseError')
  }
}

const loadKeys = async () => {
  loading.value = true
  try {
    const res = await getApiKeys()
    keyList.value = res.data
  } catch (error) {
    ElMessage.error(t('loadApiKeysFailed'))
  } finally {
    loading.value = false
  }
}

const handleGenerate = async () => {
  try {
    const { value: description } = await ElMessageBox.prompt(t('enterDescription'), t('generateApiKey'), {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      inputPattern: /.+/,
      inputErrorMessage: t('descriptionRequired')
    })

    // 选择过期时间
    const expiresAt = await new Promise((resolve) => {
      ElMessageBox.confirm(
        t('selectExpiresTime'),
        t('setExpiresTime'),
        {
          confirmButtonText: t('setExpiresTime'),
          cancelButtonText: t('neverExpire'),
          distinguishCancelAndClose: true
        }
      ).then(() => {
        // 用户选择设置过期时间，使用 prompt 输入
        ElMessageBox.prompt(
          t('selectExpiresTime'),
          t('setExpiresTime'),
          {
            confirmButtonText: t('confirm'),
            cancelButtonText: t('cancel'),
            inputType: 'datetime-local',
            inputValue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
            inputPattern: /.+/,
            inputErrorMessage: t('selectExpiresTime')
          }
        ).then(({ value }) => {
          if (value) {
            resolve(new Date(value).getTime())
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
      data.expiresAt = expiresAt
    }

    const res = await createApiKey(data)
    
    // 检查响应是否成功
    if (res.code !== 200) {
      ElMessage.error(res.message || t('generateApiKeyFailed'))
      return
    }
    
    await ElMessageBox.alert(
      `${t('apiKeyWarning')}\n\nKey: ${res.data.full_key}`,
      t('apiKeyGenerated'),
      {
        confirmButtonText: t('iHaveCopied'),
        type: 'warning'
      }
    )
    await loadKeys()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('生成API Key错误:', error)
      const errorMsg = error.response?.data?.message || error.message || t('generateApiKeyFailed')
      ElMessage.error(errorMsg)
    }
  }
}

const handleDelete = async (row) => {
  try {
    await deleteApiKey(row.id)
    ElMessage.success(t('deleteApiKeySuccess'))
    loadKeys()
  } catch (error) {
    ElMessage.error(t('deleteApiKeyFailed'))
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