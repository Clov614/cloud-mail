import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import { eq } from 'drizzle-orm';
import apiKey from '../entity/api_key';
import orm from '../entity/orm';
import { generateApiKey, hashApiKey } from '../utils/crypto-utils';

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
		keyPrefix: apiKey.keyPrefix,
		createdAt: apiKey.createdAt,
		lastUsedAt: apiKey.lastUsedAt
	}).from(apiKey).where(eq(apiKey.userId, user.userId));
	return c.json(result.ok(keys));
});

app.post('/my/api-keys', async (c) => {
	const user = c.get('user');
	if (user.canCreateApiKeys !== 1) {
		return c.json(result.error('您没有创建API-Key的权限'));
	}
	const { description } = await c.req.json();
	const { fullKey, prefix } = generateApiKey();
	const hashedKey = await hashApiKey(fullKey);
	const db = orm(c);
	const [inserted] = await db.insert(apiKey).values({
		userId: user.userId,
		description,
		keyPrefix: prefix,
		hashedKey
	}).returning({ id: apiKey.id });
	return c.json(result.ok({
		id: inserted.id,
		description,
		keyPrefix: prefix,
		fullKey
	}));
});

app.delete('/my/api-keys/:keyId', async (c) => {
	const user = c.get('user');
	const keyId = parseInt(c.req.param('keyId'));
	const db = orm(c);
	await db.delete(apiKey).where(eq(apiKey.id, keyId)).where(eq(apiKey.userId, user.userId));
	return c.json(result.ok('删除成功'));
});


