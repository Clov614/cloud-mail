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

    <!-- 美化的API Key弹窗 -->
    <el-dialog
      v-model="showApiKeyDialog"
      :title="t('apiKeyGenerated')"
      width="600px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      class="api-key-dialog"
    >
      <div class="api-key-content">
        <div class="warning-section">
          <el-icon class="warning-icon" :size="24">
            <WarningFilled />
          </el-icon>
          <div class="warning-text">
            {{ t('apiKeyWarning') }}
          </div>
        </div>

        <div class="key-section">
          <div class="key-label">API Key</div>
          <div class="key-display" @click="copyToClipboard">
            <div class="key-text">{{ generatedApiKey }}</div>
            <el-icon class="copy-icon" :size="20">
              <DocumentCopy />
            </el-icon>
          </div>
          <div class="copy-hint">{{ t('clickToCopy') }}</div>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" @click="closeApiKeyDialog" size="large">
          {{ t('iHaveCopied') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WarningFilled, DocumentCopy } from '@element-plus/icons-vue'
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
    // axios 拦截器已经处理了响应，直接返回 data.data（即数组）
    const keys = await getApiKeys()
    keyList.value = keys || []
  } catch (error) {
    console.error('加载API Keys失败:', error)
    keyList.value = []
    // axios 拦截器会自动显示错误消息
  } finally {
    loading.value = false
  }
}

const showApiKeyDialog = ref(false)
const generatedApiKey = ref('')

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(generatedApiKey.value)
    ElMessage.success(t('copiedToClipboard'))
  } catch (error) {
    // 降级方案：使用传统方法复制
    const textarea = document.createElement('textarea')
    textarea.value = generatedApiKey.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success(t('copiedToClipboard'))
    } catch (err) {
      ElMessage.error(t('copyFailed'))
    }
    document.body.removeChild(textarea)
  }
}

const closeApiKeyDialog = () => {
  showApiKeyDialog.value = false
  generatedApiKey.value = ''
  loadKeys()
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

    // axios 拦截器已经处理了响应，直接返回 data.data
    const apiKeyData = await createApiKey(data)
    
    // 显示美化的弹窗
    generatedApiKey.value = apiKeyData.full_key
    showApiKeyDialog.value = true
  } catch (error) {
    if (error !== 'cancel') {
      console.error('生成API Key错误:', error)
      // axios 拦截器会自动显示错误消息，这里只需要记录
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

:deep(.api-key-dialog) {
  .el-dialog__header {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #fff;
    padding: 20px 24px;
    margin: 0;
    border-radius: 8px 8px 0 0;
  }

  .el-dialog__title {
    color: #fff;
    font-size: 20px;
    font-weight: 600;
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: #fff;
    font-size: 20px;
    
    &:hover {
      color: #409eff;
    }
  }

  .el-dialog__body {
    padding: 30px 24px;
    background: #f5f7fa;
  }

  .el-dialog__footer {
    padding: 20px 24px;
    background: #f5f7fa;
    border-radius: 0 0 8px 8px;
  }
}

.api-key-content {
  .warning-section {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    margin-bottom: 24px;

    .warning-icon {
      color: #ff9800;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .warning-text {
      color: #856404;
      font-size: 14px;
      line-height: 1.6;
      flex: 1;
    }
  }

  .key-section {
    .key-label {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 12px;
    }

    .key-display {
      position: relative;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border: 2px solid #3a3a3a;
      border-radius: 8px;
      padding: 16px 50px 16px 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      overflow: hidden;

      &:hover {
        border-color: #409eff;
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
        transform: translateY(-2px);

        .copy-icon {
          color: #409eff;
        }
      }

      &:active {
        transform: translateY(0);
      }

      .key-text {
        color: #00ff88;
        font-family: 'Courier New', Courier, monospace;
        font-size: 14px;
        word-break: break-all;
        line-height: 1.6;
        padding-right: 10px;
      }

      .copy-icon {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        color: #909399;
        transition: color 0.3s ease;
      }
    }

    .copy-hint {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
      text-align: center;
    }
  }
}
</style>