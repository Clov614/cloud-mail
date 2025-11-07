import BizError from '../error/biz-error';
import constant from '../const/constant';
import jwtUtils from '../utils/jwt-utils';
import KvConst from '../const/kv-const';
import dayjs from 'dayjs';
import userService from '../service/user-service';
import permService from '../service/perm-service';
import { t } from '../i18n/i18n'
import app from '../hono/hono';
import { hashApiKey } from '../utils/crypto-utils';
import apiKey from '../entity/api_key';
import User from '../entity/user';
import { eq } from 'drizzle-orm';
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
	'/test'
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
		// 没有 API Key，假定这是普通的浏览器请求。
		// 不做任何事，直接进入下一个中间件 (即 `auth` 中间件)。
		await next();
		return;
	}

	// 验证逻辑
	// 1. 哈希传入的 Key (使用 M-API-002 的函数)
	const hashedKey = await hashApiKey(key);

	// 2. 查询数据库，同时 join User 表
	const db = orm(c);
	const [apiKeyWithUser] = await db.select()
		.from(apiKey)
		.where(eq(apiKey.hashedKey, hashedKey))
		.leftJoin(User, eq(apiKey.userId, User.userId));

	// 3. 处理无效 Key
	if (!apiKeyWithUser || !apiKeyWithUser.user) {
		return c.json(result.fail('Invalid API Key'), 401);
	}

	// 4. 时效性检查
	const apiKeyData = apiKeyWithUser.api_key;
	if (apiKeyData.expiresAt && new Date() > new Date(apiKeyData.expiresAt)) {
		return c.json(result.fail('API-Key 已过期'), 401);
	}

	// 5. Scope 注入
	const scopesArray = JSON.parse(apiKeyData.scopes);

	// 6. 注入上下文
	const user = apiKeyWithUser.user;
	c.set('user', user); // <-- 核心步骤，与 user-context.js 行为一致
	c.set('api_scopes', scopesArray); // <-- [新增] 注入权限范围

	// 6. 质量优化 更新 Key 的 "最后使用时间" (异步，不阻塞)
	const updateLastUsed = async () => {
		try {
			await db.update(apiKey)
				.set({ lastUsedAt: new Date() })
				.where(eq(apiKey.id, apiKeyWithUser.api_key.id));
		} catch (e) {
			// 记录错误，但不影响主流程
			console.error('Failed to update API key last_used_at', e);
		}
	};
	c.executionCtx.waitUntil(updateLastUsed());

	// 7. 进入受保护的路由 (M-API-007)
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

/**
 * Scope 权限校验中间件工厂函数
 * @param {string} requiredScope - 需要的权限范围
 * @returns {Function} Hono 中间件函数
 */
const checkScope = (requiredScope) => {
	return async (c, next) => {
		const apiScopes = c.get('api_scopes');

		// 如果没有 api_scopes，说明不是通过 API Key 认证的
		if (!apiScopes) {
			await next();
			return;
		}

		// 检查是否包含所需权限或超管权限
		if (!apiScopes.includes(requiredScope) && !apiScopes.includes('admin')) {
			return c.json(result.fail('权限不足 (Insufficient Scope)'), 403);
		}

		await next();
	};
};

export {
	auth,
	adminAuth,
	apiKeyAuthMiddleware,
	checkScope
};
