import http from '@/axios/index.js';

export function loginUserInfo() {
    return http.get('/my/loginUserInfo')
}

export function resetPassword(password) {
    return http.put('/my/resetPassword', {password})
}

export function userDelete() {
    return http.delete('/my/delete')
}

// 获取 API Key 列表
export function getApiKeys() {
    return http.get('/my/api-keys')
}

// 创建 API Key
export function createApiKey(data) {
    return http.post('/my/api-keys', data)
}

// 删除 API Key
export function deleteApiKey(keyId) {
    return http.delete(`/my/api-keys/${keyId}`)
}

