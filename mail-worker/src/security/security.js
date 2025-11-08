import BizError from '../error/biz-error';
import constant from '../const/constant';
import jwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import dayjs from 'dayjs';
import userService from '../service/user-service';
import permService from '../service/perm-service';
import { t } from '../i18n/i18n'
import app from '../hono/hono';
import { hashApiKey, timingSafeEqual } from '../utils/crypto-utils';
import apiKey from '../entity/api_key';
import User from '../entity/user';
import { eq, like } from 'drizzle-orm';
import orm from '../entity/orm';
import result from '../model/result';

const exclude = [
	'/login',
	'/register',
	'/oss',
	'/setting/websiteConfig',
	'/webhooks',
	'/init',
	'/public/genToken',
	'/telegram',
	'/test',
	'/v1'
];

const requirePerms = [
	'/email/send',
	'/email/delete',
	'/account/list',
	'/account/delete',
	'/account/add',
	'/my/delete',
	'/my/api-keys',
	'/v1/emails/generate',
	'/v1/emails',
	'/role/add',
	'/role/list',
	'/role/delete',
	'/role/tree',
	'/role/set',
	'/role/setDefault',
	'/allEmail/list',
	'/allEmail/delete',
	'/setting/setBackground',
	'/setting/deleteBackground',
	'/setting/set',
	'/setting/query',
	'/user/delete',
	'/user/setPwd',
	'/user/setStatus',
	'/user/setType',
	'/user/list',
	'/user/resetSendCount',
	'/user/add',
	'/user/deleteAccount',
	'/user/allAccount',
	'/user/api-permission',
	'/user/api-scopes',
	'/regKey/add',
	'/regKey/list',
	'/regKey/delete',
	'/regKey/clearNotUse',
	'/regKey/history'
];

const premKey = {
	'email:delete': ['/email/delete'],
	'email:send': ['/email/send'],
	'account:add': ['/account/add'],
	'account:query': ['/account/list'],
	'account:delete': ['/account/delete'],
	'my:delete': ['/my/delete'],
	'api:manage': ['/my/api-keys'],
	'api:email-generate': ['/v1/emails/generate'],
	'api:email-list': ['/v1/emails'],
	'api:email-detail': ['/v1/emails'],
	'role:add': ['/role/add'],
	'role:set': ['/role/set','/role/setDefault'],
	'role:query': ['/role/list', '/role/tree'],
	'role:delete': ['/role/delete'],
	'user:query': ['/user/list','/user/allAccount'],
	'user:add': ['/user/add'],
	'user:reset-send': ['/user/resetSendCount'],
	'user:set-pwd': ['/user/setPwd'],
	'user:set-status': ['/user/setStatus'],
	'user:set-type': ['/user/setType'],
	'user:set-api-permission': ['/user/api-permission'],
	'user:set-api-scopes': ['/user/api-scopes'],
	'user:delete': ['/user/delete','/user/deleteAccount'],
	'all-email:query': ['/allEmail/list'],
	'all-email:delete': ['/allEmail/delete','/allEmail/batchDelete'],
	'setting:query': ['/setting/query'],
	'setting:set': ['/setting/set', '/setting/setBackground','/setting/deleteBackground'],
	'analysis:query': ['/analysis/echarts'],
	'reg-key:add': ['/regKey/add'],
	'reg-key:query': ['/regKey/list','/regKey/history'],
	'reg-key:delete': ['/regKey/delete','/regKey/clearNotUse'],
};

app.use('*', async (c, next) => {

	const path = c.req.path;
	
	// /v1 路径完全由 v1Api 自己处理，这里直接跳过
	if (path.startsWith('/v1')) {
		return await next();
	}

	const index = exclude.findIndex(item => {
		return path.startsWith(item);
	});

	if (index > -1) {
		return await next();
	}

	if (path.startsWith('/public')) {

		const userPublicToken = await c.env.kv.get(KvConst.PUBLIC_KEY);
		const publicToken = c.req.header(constant.TOKEN_HEADER);
		if (publicToken !== userPublicToken) {
			throw new BizError(t('publicTokenFail'), 401);
		}
		return await next();
	}

	const jwt = c.req.header(constant.TOKEN_HEADER);

	const result = await jwtUtils.verifyToken(c, jwt);

	if (!result) {
		throw new BizError(t('authExpired'), 401);
	}

	const { userId, token } = result;
	const authInfo = await c.env.kv.get(KvConst.AUTH_INFO + userId, { type: 'json' });

	if (!authInfo) {
		throw new BizError(t('authExpired'), 401);
	}

	if (!authInfo.tokens.includes(token)) {
		throw new BizError(t('authExpired'), 401);
	}

	const permIndex = requirePerms.findIndex(item => {
		return path.startsWith(item);
	});

	if (permIndex > -1) {

		const permKeys = await permService.userPermKeys(c, authInfo.user.userId);

		const userPaths = permKeyToPaths(permKeys);

		const userPermIndex = userPaths.findIndex(item => {
			return path.startsWith(item);
		});

		if (userPermIndex === -1 && authInfo.user.email !== c.env.admin) {
			throw new BizError(t('unauthorized'), 403);
		}

	}

	const refreshTime = dayjs(authInfo.refreshTime).startOf('day');
	const nowTime = dayjs().startOf('day')

	if (!nowTime.isSame(refreshTime)) {
		authInfo.refreshTime = dayjs().toISOString();
		await userService.updateUserInfo(c, authInfo.user.userId);
		await c.env.kv.put(KvConst.AUTH_INFO + userId, JSON.stringify(authInfo), { expirationTtl: constant.TOKEN_EXPIRE });
	}

	c.set('user',authInfo.user)

	return await next();
});

/**
	* API Key 认证中间件
	*/
const apiKeyAuthMiddleware = async (c, next) => {
	const key = c.req.header('X-API-Key');

	if (!key) {
		// 如果没有 API Key，交由下一个中间件处理 (通常是JWT认证)
		return await next();
	}

	// --- API Key 认证流程 ---

	const db = orm(c);

	// 1. 根据 key_prefix 快速查找
	// 'cm_sk_xxxx'
	if (key.length < 8 || !key.startsWith('cm_sk_')) {
		return c.json(result.fail('Invalid API Key format', 401), 401);
	}
	const keyPrefix = key.substring(0, 8); // 'cm_sk_xx'
	const possibleKeys = await db.select()
		.from(apiKey)
		.where(eq(apiKey.keyPrefix, keyPrefix));

	if (!possibleKeys.length) {
		return c.json(result.fail('Invalid API Key', 401), 401);
	}

	// 2. 哈希传入的完整 Key
	const incomingHashedKey = await hashApiKey(key);
	let matchedApiKey = null;

	// 3. 时序安全地比较哈希值
	for (const keyRecord of possibleKeys) {
		if (timingSafeEqual(keyRecord.hashedKey, incomingHashedKey)) {
			matchedApiKey = keyRecord;
			break;
		}
	}

	// 4. 处理无效 Key
	if (!matchedApiKey) {
		return c.json(result.fail('Invalid API Key', 401), 401);
	}

	// 5. 查询关联的用户
	const [userRecord] = await db.select()
		.from(User)
		.where(eq(User.userId, matchedApiKey.userId));

	if (!userRecord) {
		// 数据不一致的罕见情况
		return c.json(result.fail('Invalid API Key - User not found', 401), 401);
	}

	// 6. 检查 Key 是否过期
	if (matchedApiKey.expiresAt && new Date() > new Date(matchedApiKey.expiresAt)) {
		return c.json(result.fail('API Key has expired', 401), 401);
	}
	
	// 7. 注入上下文
	const scopesArray = matchedApiKey.scopes ? JSON.parse(matchedApiKey.scopes) : [];
	c.set('user', userRecord);
	c.set('api_scopes', scopesArray);

	// 8. 异步更新 "最后使用时间"
	const updateLastUsed = async () => {
		try {
			await db.update(apiKey)
				.set({ lastUsedAt: new Date() })
				.where(eq(apiKey.id, matchedApiKey.id));
		} catch (e) {
			console.error('Failed to update API key last_used_at:', e);
		}
	};
	c.executionCtx.waitUntil(updateLastUsed());

	// 9. 进入受保护的路由
	await next();
};

function permKeyToPaths(permKeys) {

	const paths = [];

	for (const key of permKeys) {
		const routeList = premKey[key];
		if (routeList && Array.isArray(routeList)) {
			paths.push(...routeList);
		}
	}
	return paths;
}

// ↓↓↓ [修复] 恢复 auth 函数 ↓↓↓
const auth = async (c, next) => {
	const url = new URL(c.req.url);
	if (exclude.some(path => url.pathname.startsWith('/api' + path))) {
		await next();
		return;
	}
	await next();
};

// ↓↓↓ [修复] 恢复 adminAuth 函数 ↓↓↓
const adminAuth = async (c, next) => {
	const user = c.get('user');
	if (user.type !== constant.USER_TYPE_ADMIN) {
		return c.json(result.fail(t('notAdmin')));
	}
	const db = orm(c);
	const check = await permService.checkUserPerm(db, user.userId, c.req.path);
	if (check === false) {
		return c.json(result.fail(t('notPerms')));
	}
	await next();
};

export {
	auth,
	adminAuth,
	apiKeyAuthMiddleware
};
