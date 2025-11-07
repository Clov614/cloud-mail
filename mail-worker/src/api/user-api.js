import app from '../hono/hono';
import userService from '../service/user-service';
import result from '../model/result';
import userContext from '../security/user-context';
import accountService from '../service/account-service';
import { eq } from 'drizzle-orm';
import User from '../entity/user';
import orm from '../entity/orm';

app.delete('/user/delete', async (c) => {
	await userService.physicsDelete(c, c.req.query());
	return c.json(result.ok());
});

app.put('/user/setPwd', async (c) => {
	await userService.setPwd(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/setStatus', async (c) => {
	await userService.setStatus(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/setType', async (c) => {
	await userService.setType(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/user/list', async (c) => {
	const data = await userService.list(c, c.req.query(), userContext.getUserId(c));
	return c.json(result.ok(data));
});

app.post('/user/add', async (c) => {
	await userService.add(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/resetSendCount', async (c) => {
	await userService.resetSendCount(c, await c.req.json());
	return c.json(result.ok());
});

app.put('/user/restore', async (c) => {
	await userService.restore(c, await c.req.json());
	return c.json(result.ok());
});

app.get('/user/allAccount', async (c) => {
	const data = await accountService.allAccount(c, c.req.query());
	return c.json(result.ok(data));
});
app.delete('/user/deleteAccount', async (c) => {
	await accountService.physicsDelete(c, c.req.query());
	return c.json(result.ok());
});

app.put('/user/:userId/api-permission', async (c) => {
	const userId = parseInt(c.req.param('userId'));
	const { can_create_api_keys } = await c.req.json();

	if (can_create_api_keys !== 0 && can_create_api_keys !== 1) {
		return c.json(result.error('无效的状态值'));
	}

	const db = orm(c);
	const updateResult = await db.update(User)
		.set({ canCreateApiKeys: can_create_api_keys })
		.where(eq(User.userId, userId));

	if (updateResult.rowsAffected === 0) {
		return c.json(result.error('用户不存在'));
	}

	return c.json(result.ok('权限更新成功'));
});



