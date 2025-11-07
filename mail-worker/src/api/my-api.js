import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import { eq } from 'drizzle-orm';
import apiKey from '../entity/api_key';
import orm from '../entity/orm';
import { generateApiKey, hashApiKey } from '../utils/crypto-utils';
import { t } from '../i18n/i18n';

app.get('/my/loginUserInfo', async (c) => {
	const user = await userService.loginUserInfo(c, userContext.getUserId(c));
	return c.json(result.ok(user));
});

app.put('/my/resetPassword', async (c) => {
	await userService.resetPassword(c, await c.req.json(), userContext.getUserId(c));
	return c.json(result.ok());
});

app.delete('/my/delete', async (c) => {
	await userService.delete(c, userContext.getUserId(c));
	return c.json(result.ok());
});

app.get('/my/api-keys', async (c) => {
	const user = c.get('user');
	const db = orm(c);
	const keys = await db.select({
		id: apiKey.id,
		description: apiKey.description,
		key_prefix: apiKey.keyPrefix,
		created_at: apiKey.createdAt,
		last_used_at: apiKey.lastUsedAt,
		expires_at: apiKey.expiresAt,
		scopes: apiKey.scopes
	}).from(apiKey).where(eq(apiKey.userId, user.userId));
	return c.json(result.ok(keys));
});

app.post('/my/api-keys', async (c) => {
	const user = c.get('user');
	
	// 检查用户是否有 api:manage 权限或是超管
	const db = orm(c);
	const permService = require('../service/perm-service').default;
	const userPermKeys = await permService.userPermKeys(c, user.userId);
	const isAdmin = user.email === c.env.admin;
	
	if (!userPermKeys.includes('api:manage') && !isAdmin) {
		return c.json(result.fail(t('noApiKeyPermission')));
	}
	
	const { description, expiresAt } = await c.req.json();

	// 根据用户的权限确定 API Key 的 scopes
	const scopes = [];
	
	// 超管拥有所有权限
	if (isAdmin) {
		scopes.push('api:email-generate', 'api:email-list', 'api:email-detail');
	} else {
		// 普通用户根据权限添加
		if (userPermKeys.includes('api:email-generate')) {
			scopes.push('api:email-generate');
		}
		if (userPermKeys.includes('api:email-list')) {
			scopes.push('api:email-list');
		}
		if (userPermKeys.includes('api:email-detail')) {
			scopes.push('api:email-detail');
		}
	}
	
	// 如果没有任何 API 权限，返回错误
	if (scopes.length === 0) {
		return c.json(result.fail(t('noApiScopePermission')));
	}

	const { fullKey, prefix } = generateApiKey();
	const hashedKey = await hashApiKey(fullKey);
	const [inserted] = await db.insert(apiKey).values({
		userId: user.userId,
		description,
		keyPrefix: prefix,
		hashedKey,
		expiresAt: expiresAt ? new Date(expiresAt) : null,
		scopes: JSON.stringify(scopes)
	}).returning({ id: apiKey.id });
	
	return c.json(result.ok({
		id: inserted.id,
		description,
		key_prefix: prefix,
		fullKey,
		expires_at: expiresAt,
		scopes
	}));
});

app.delete('/my/api-keys/:keyId', async (c) => {
	const user = c.get('user');
	const keyId = parseInt(c.req.param('keyId'));
	const db = orm(c);
	await db.delete(apiKey).where(eq(apiKey.id, keyId)).where(eq(apiKey.userId, user.userId));
	return c.json(result.ok('删除成功'));
});


